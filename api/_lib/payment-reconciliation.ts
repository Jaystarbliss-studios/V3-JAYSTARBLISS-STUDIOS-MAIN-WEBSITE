import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { calculateCustomerCharge, getFeePolicy, getPaymentConfig } from "./billing";
import { createPortalNotification } from "./email";

const asString = (value: unknown) => String(value ?? "").trim();

export async function reconcileSuccessfulCharge(tx: any, verifiedUserId?: string) {
  const reference = asString(tx.reference);
  const metadata = tx.metadata || {};
  const userId = asString(metadata.userId);
  const role = asString(metadata.role).toLowerCase();
  const planId = asString(metadata.planId);
  const enrollmentRequestId = asString(metadata.enrollmentRequestId);
  if (!reference || !userId || !planId) throw new Error("PAYMENT_METADATA_INVALID");
  if (verifiedUserId && userId !== verifiedUserId) throw new Error("PAYMENT_OWNER_MISMATCH");

  const config = await getPaymentConfig();
  const plan = config.plans[planId];
  if (!plan || !plan.active) throw new Error("PAYMENT_PLAN_INVALID");
  const feeRole = role === "school" ? "school" : "parent";
  const charge = calculateCustomerCharge(plan.baseAmount, getFeePolicy(config, feeRole));
  const providerAmount = Number(tx.amount || 0) / 100;
  const expectedGross = Math.round(charge.totalAmount * 100) / 100;
  const metadataTotal = Number(metadata.customerTotal || 0);
  if (String(tx.status || "").toLowerCase() !== "success" || String(tx.currency || "").toUpperCase() !== "NGN" || Math.round(providerAmount * 100) !== Math.round(expectedGross * 100) || (metadataTotal && Math.round(metadataTotal * 100) !== Math.round(expectedGross * 100))) {
    throw new Error("PAYMENT_AMOUNT_MISMATCH");
  }

  const canonicalPaymentRef = adminDb.collection("payments").doc(reference);
  const enrollmentRef = enrollmentRequestId ? adminDb.collection("enrollment_requests").doc(enrollmentRequestId) : null;
  const userRef = adminDb.collection("users").doc(userId);
  let created = false;
  let paymentData: Record<string, any> = {};

  await adminDb.runTransaction(async transaction => {
    const paymentSnap = await transaction.get(canonicalPaymentRef);
    if (paymentSnap.exists) return;
    const enrollmentSnap = enrollmentRef ? await transaction.get(enrollmentRef) : null;
    const userSnap = await transaction.get(userRef);
    const userRecord = userSnap.exists ? userSnap.data() || {} : {};
    const enrollment = enrollmentSnap?.exists ? enrollmentSnap.data() || {} : {};

    if (enrollmentRequestId) {
      if (role !== "parent") throw new Error("PAYMENT_ENROLLMENT_ROLE_INVALID");
      if (!enrollmentSnap?.exists) throw new Error("ENROLLMENT_NOT_FOUND");
      if (asString(enrollment.parentId) !== userId) throw new Error("ENROLLMENT_OWNER_MISMATCH");
      if (asString(enrollment.planId) && asString(enrollment.planId) !== planId) throw new Error("ENROLLMENT_PLAN_MISMATCH");
      if (asString(enrollment.paymentStatus).toUpperCase() === "PAID") throw new Error("ENROLLMENT_ALREADY_PAID");
    }

    const studentId = asString(metadata.studentId || enrollment.studentId);
    const tutorId = asString(metadata.tutorId || enrollment.tutorId);
    const schoolId = asString(metadata.schoolId || enrollment.schoolId || userRecord.schoolId);
    const studentName = asString(metadata.studentName || enrollment.studentName || enrollment.enrollmentStudentName);
    const paidAt = tx.paid_at ? new Date(tx.paid_at) : new Date();

    paymentData = {
      userId,
      parentId: role === "parent" ? userId : null,
      schoolId: role === "school" ? schoolId || userId : schoolId || null,
      studentId: studentId || null,
      studentName: studentName || null,
      tutorId: tutorId || null,
      tutorName: null,
      tutorEmail: null,
      enrollmentRequestId: enrollmentRequestId || null,
      enrollmentStudentName: studentName || null,
      planId,
      plan: plan.name,
      baseAmount: charge.baseAmount,
      transactionFee: charge.transactionFee,
      amount: Math.round(charge.totalAmount * 100),
      customerTotal: charge.totalAmount,
      currency: "NGN",
      durationWeeks: Number(metadata.durationWeeks || enrollment.durationWeeks || plan.durationWeeks),
      teachingMode: asString(metadata.teachingMode || enrollment.teachingMode || enrollment.modeOfTeaching || plan.teachingModes[0]),
      paymentMethod: asString(tx.channel || metadata.paymentMethod || "paystack"),
      status: "PAID",
      reference,
      email: asString(tx.customer?.email || userRecord.email),
      description: `${plan.name} • ${studentName || (role === "school" ? "School account" : "Student account")}`,
      providerTransactionId: tx.id || null,
      gatewayResponse: tx.gateway_response || null,
      paidAt,
      createdAt: new Date(),
      verifiedAt: new Date(),
      verifiedBy: verifiedUserId ? "portal_return" : "paystack_webhook",
      walletCredited: Boolean(tutorId)
    };

    if (tutorId) {
      const tutorSnap = await transaction.get(adminDb.collection("users").doc(tutorId));
      const tutor = tutorSnap.exists ? tutorSnap.data() || {} : {};
      paymentData.tutorName = tutor.name || tutor.displayName || tutor.email || tutorId;
      paymentData.tutorEmail = tutor.email || null;
    }

    transaction.create(canonicalPaymentRef, paymentData);
    created = true;

    if (enrollmentRef) {
      transaction.set(enrollmentRef, {
        paymentStatus: "PAID",
        paymentReference: reference,
        paymentPlanId: planId,
        paymentPlanName: plan.name,
        paymentBaseAmount: charge.baseAmount,
        paymentTransactionFee: charge.transactionFee,
        paymentTotal: charge.totalAmount,
        durationWeeks: paymentData.durationWeeks,
        teachingMode: paymentData.teachingMode,
        studentId: studentId || null,
        tutorId: tutorId || null,
        schoolId: schoolId || null,
        paidAt,
        updatedAt: new Date()
      }, { merge: true });
    }

    if (tutorId) {
      transaction.set(adminDb.collection("staffWallets").doc(tutorId), {
        availableBalance: FieldValue.increment(charge.baseAmount),
        lifetimeEarned: FieldValue.increment(charge.baseAmount),
        updatedAt: new Date()
      }, { merge: true });
    }
  });

  if (!created) return { created: false, payment: null };

  await createPortalNotification({
    recipientId: userId,
    email: paymentData.email,
    title: "Payment confirmed",
    message: `${paymentData.plan} payment for ${paymentData.studentName || "your account"} was verified for ₦${paymentData.customerTotal.toLocaleString()}. Your paid-through date is ${new Date(new Date(paymentData.paidAt).getTime() + paymentData.durationWeeks * 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-NG")}.`,
    type: "PAYMENT_CONFIRMED",
    data: { paymentId: reference, planId, studentId: paymentData.studentId, tutorId: paymentData.tutorId }
  });
  if (paymentData.tutorId && paymentData.tutorEmail) {
    await createPortalNotification({
      recipientId: paymentData.tutorId,
      email: paymentData.tutorEmail,
      title: "Student payment received",
      message: `${paymentData.studentName || "An assigned student"} has paid ${paymentData.plan}. ₦${paymentData.baseAmount.toLocaleString()} has been credited to your staff wallet.`,
      type: "STUDENT_PAYMENT",
      data: { paymentId: reference, studentId: paymentData.studentId, amount: paymentData.baseAmount }
    });
  }
  return { created: true, payment: paymentData };
}
