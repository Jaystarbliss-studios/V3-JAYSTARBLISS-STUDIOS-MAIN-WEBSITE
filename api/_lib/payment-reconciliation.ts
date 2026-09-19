import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { calculateCustomerCharge, getFeePolicy, getPaymentConfig, normaliseRole } from "./billing";
import { createPortalNotification } from "./email";

const asString = (value: unknown) => String(value ?? "").trim();

export async function reconcileSuccessfulCharge(tx: any, verifiedUserId?: string) {
  const reference = asString(tx.reference);
  const metadata = tx.metadata || {};
  const userId = asString(metadata.userId);
  const requestedRole = asString(metadata.role).toLowerCase();
  const planId = asString(metadata.planId);
  const enrollmentRequestId = asString(metadata.enrollmentRequestId);
  if (!reference || !userId || !planId) throw new Error("PAYMENT_METADATA_INVALID");
  if (verifiedUserId && userId !== verifiedUserId) throw new Error("PAYMENT_OWNER_MISMATCH");

  const config = await getPaymentConfig();
  const userSnapForBilling = await adminDb.collection("users").doc(userId).get();
  const userForBilling = userSnapForBilling.exists ? userSnapForBilling.data() || {} : {};
  let assignedBilling = userForBilling.billing || null;
  if (requestedRole === "school") {
    const assignedSchoolId = asString(userForBilling.schoolId);
    if (assignedSchoolId) {
      const assignedSchoolSnap = await adminDb.collection("schools").doc(assignedSchoolId).get();
      if (assignedSchoolSnap.exists && assignedSchoolSnap.data()?.billing) {
        assignedBilling = assignedSchoolSnap.data()?.billing;
      }
    }
  }

  let plan = config.plans[planId];

  // Admin-assigned billing is authoritative at reconciliation too. This protects
  // against a generic frontend plan ID being paired with an admin-assigned fee.
  if (assignedBilling && Number(assignedBilling.baseAmount) > 0 && String(assignedBilling.status || "ACTIVE").toUpperCase() !== "DISABLED") {
    const cycle = asString(assignedBilling.cycle || "monthly").toLowerCase();
    plan = {
      id: asString(assignedBilling.planId || planId || "assigned_plan"),
      name: asString(assignedBilling.planName || metadata.planName || (requestedRole === "school" ? "Fees/Payments" : "Assigned Tuition Plan")),
      role: requestedRole === "school" ? "school" : "student",
      baseAmount: Number(assignedBilling.baseAmount),
      durationWeeks: cycle === "termly" ? 12 : 4,
      teachingModes: ["Standard Delivery", "Hybrid / Physical"],
      description: "Admin-assigned billing plan",
      active: true
    };
  }

  // Resolve admin-assigned or custom billing plan if not found in static config or marked inactive
  if (!plan || !plan.active) {
    const metadataBase = Number(metadata.baseAmount || 0);
    const txAmountBase = Number(tx.amount || 0) / 100;
    const baseAmount = metadataBase > 0 ? metadataBase : txAmountBase;
    if (baseAmount > 0) {
      plan = {
        id: planId || "assigned_plan",
        name: asString(metadata.planName || metadata.plan || (requestedRole === "school" ? "Institutional Partner Fee" : "Assigned Tuition Plan")),
        role: (requestedRole === "school" || (plan && plan.role === "school")) ? "school" : "student",
        baseAmount,
        durationWeeks: Number(metadata.durationWeeks || (requestedRole === "school" ? 4 : 4)),
        teachingModes: ["Standard Delivery", "Hybrid / Physical"],
        description: "Admin-assigned institutional / tuition plan",
        active: true
      };
    } else if (plan) {
      // If plan existed in config but had active:false, activate it for this assigned payment
      plan = { ...plan, active: true };
    } else {
      throw new Error("PAYMENT_PLAN_INVALID");
    }
  }

  const userSnap = await adminDb.collection("users").doc(userId).get();
  if (!userSnap.exists) throw new Error("PAYMENT_USER_NOT_FOUND");
  const userRecord = userSnap.data() || {};
  const authoritativeRole = normaliseRole(userRecord.role);
  if (requestedRole && requestedRole !== authoritativeRole) throw new Error("PAYMENT_ROLE_MISMATCH");
  const role = authoritativeRole;
  if (!["parent", "school", "student"].includes(role)) throw new Error("PAYMENT_ROLE_INVALID");
  if (role === "school" && plan.role !== "school") throw new Error("PAYMENT_PLAN_ROLE_MISMATCH");
  if (role !== "school" && plan.role !== "student") throw new Error("PAYMENT_PLAN_ROLE_MISMATCH");

  const feeRole = role === "school" ? "school" : "parent";
  const chargePreview = calculateCustomerCharge(plan.baseAmount, getFeePolicy(config, feeRole));
  const providerAmount = Number(tx.amount || 0) / 100;
  const expectedBase = Math.round(plan.baseAmount * 100);
  const expectedCustomerTotal = Math.round(chargePreview.totalAmount * 100);
  const providerAmountMinor = Math.round(providerAmount * 100);
  const amountMatchesBase = providerAmountMinor === expectedBase;
  const amountMatchesCustomerTotal = providerAmountMinor === expectedCustomerTotal;

  // Paystack is configured to pass its transaction fee to the customer at checkout.
  // The gateway transaction amount therefore represents the base tuition, while tx.fees
  // is the actual Paystack processing fee. Never expect the pre-calculated gross total
  // to be the gateway amount, otherwise the customer is charged the fee twice.
  if (String(tx.status || "").toLowerCase() !== "success" || String(tx.currency || "").toUpperCase() !== "NGN" || (!amountMatchesBase && !amountMatchesCustomerTotal)) {
    throw new Error("PAYMENT_AMOUNT_MISMATCH");
  }

  const actualTransactionFee = Number.isFinite(Number(tx.fees)) && Number(tx.fees) >= 0
    ? Number((Number(tx.fees) / 100).toFixed(2))
    : chargePreview.transactionFee;
  const customerTotal = amountMatchesCustomerTotal ? providerAmount : Number((plan.baseAmount + actualTransactionFee).toFixed(2));

  const metadataBase = Number(metadata.baseAmount || 0);
  if (metadataBase && Math.round(metadataBase * 100) !== expectedBase) throw new Error("PAYMENT_METADATA_AMOUNT_MISMATCH");

  const canonicalPaymentRef = adminDb.collection("payments").doc(reference);
  const enrollmentRef = enrollmentRequestId ? adminDb.collection("enrollment_requests").doc(enrollmentRequestId) : null;
  let created = false;
  let paymentData: Record<string, any> = {};

  await adminDb.runTransaction(async transaction => {
    const paymentSnap = await transaction.get(canonicalPaymentRef);
    if (paymentSnap.exists) return;
    const enrollmentSnap = enrollmentRef ? await transaction.get(enrollmentRef) : null;
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

    if (role === "student") {
      const ownStudentId = asString(userRecord.studentDocId);
      if (!ownStudentId || (studentId && studentId !== ownStudentId)) throw new Error("PAYMENT_STUDENT_OWNER_MISMATCH");
    }
    if (role === "school" && schoolId && asString(userRecord.schoolId) !== schoolId) throw new Error("PAYMENT_SCHOOL_OWNER_MISMATCH");
    if (role === "parent" && studentId) {
      let studentSnap = await transaction.get(adminDb.collection("individualStudents").doc(studentId));
      if (!studentSnap.exists) studentSnap = await transaction.get(adminDb.collection("students").doc(studentId));
      if (!studentSnap.exists || asString(studentSnap.data()?.parentId) !== userId) throw new Error("PAYMENT_STUDENT_OWNER_MISMATCH");
    }

    const durationWeeks = Number(metadata.durationWeeks || enrollment.durationWeeks || plan.durationWeeks || 4);
    const cycleDays = durationWeeks * 7;
    const paidThrough = new Date(paidAt.getTime() + cycleDays * 24 * 60 * 60 * 1000);
    const quarterNumber = Math.floor(paidAt.getMonth() / 3) + 1;
    const escrowQuarter = `Q${quarterNumber} ${paidAt.getFullYear()}`;
    const paymentSource = asString(metadata.paymentSource || "This Quarter's Escrow Account");

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
      baseAmount: plan.baseAmount,
      transactionFee: actualTransactionFee,
      estimatedTransactionFee: chargePreview.transactionFee,
      amount: Math.round(customerTotal * 100),
      providerAmount: providerAmountMinor,
      customerTotal,
      currency: "NGN",
      durationWeeks,
      cycleDays,
      teachingMode: asString(metadata.teachingMode || enrollment.teachingMode || enrollment.modeOfTeaching || plan.teachingModes[0]),
      paymentMethod: asString(tx.channel || metadata.paymentMethod || "paystack"),
      paymentSource,
      escrowQuarter,
      paidThrough: paidThrough.toISOString(),
      nextDueDate: paidThrough.toISOString(),
      status: "PAID",
      reference,
      email: asString(tx.customer?.email || userRecord.email),
      description: `${plan.name} • ${studentName || (role === "school" ? "School account" : "Student account")}`,
      providerTransactionId: tx.id || null,
      gatewayResponse: tx.gateway_response || null,
      gatewayFeeVerified: Number.isFinite(Number(tx.fees)),
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

    // Update school or user billing record with active paid status and 4-week renewal due date
    if (role === "school" && (schoolId || userId)) {
      const targetSchoolRef = adminDb.collection("schools").doc(schoolId || userId);
      transaction.set(targetSchoolRef, {
        billing: {
          status: "PAID",
          lastPaidAt: paidAt.toISOString(),
          paidThrough: paidThrough.toISOString(),
          nextDueDate: paidThrough.toISOString(),
          paymentSource,
          escrowQuarter,
          cycle: durationWeeks === 12 ? "termly" : "monthly",
          baseAmount: plan.baseAmount,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });
    }

    if (role === "parent" || role === "student") {
      const targetUserRef = adminDb.collection("users").doc(userId);
      transaction.set(targetUserRef, {
        billing: {
          status: "PAID",
          lastPaidAt: paidAt.toISOString(),
          paidThrough: paidThrough.toISOString(),
          nextDueDate: paidThrough.toISOString(),
          paymentSource,
          escrowQuarter,
          cycle: "monthly",
          baseAmount: plan.baseAmount,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });
    }

    if (enrollmentRef) transaction.set(enrollmentRef, {
      paymentStatus: "PAID",
      paymentReference: reference,
      paymentPlanId: planId,
      paymentPlanName: plan.name,
      paymentBaseAmount: plan.baseAmount,
      paymentTransactionFee: actualTransactionFee,
      paymentEstimatedTransactionFee: chargePreview.transactionFee,
      paymentTotal: customerTotal,
      paymentProviderAmount: plan.baseAmount,
      paymentFeeVerified: Number.isFinite(Number(tx.fees)),
      durationWeeks: paymentData.durationWeeks,
      teachingMode: paymentData.teachingMode,
      studentId: studentId || null,
      tutorId: tutorId || null,
      schoolId: schoolId || null,
      paidAt,
      updatedAt: new Date()
    }, { merge: true });

    if (tutorId) transaction.set(adminDb.collection("staffWallets").doc(tutorId), { availableBalance: FieldValue.increment(plan.baseAmount), lifetimeEarned: FieldValue.increment(plan.baseAmount), updatedAt: new Date() }, { merge: true });
  });

  if (!created) return { created: false, payment: null };
  await createPortalNotification({ recipientId: userId, email: paymentData.email, title: "Payment confirmed", message: `${paymentData.plan} payment for ${paymentData.studentName || "your account"} was verified. Tuition: ₦${paymentData.baseAmount.toLocaleString()}, Paystack fee: ₦${paymentData.transactionFee.toLocaleString()}, customer total: ₦${paymentData.customerTotal.toLocaleString()}. Your paid-through date is ${new Date(new Date(paymentData.paidAt).getTime() + paymentData.durationWeeks * 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-NG")}.`, type: "PAYMENT_CONFIRMED", data: { paymentId: reference, planId, studentId: paymentData.studentId, tutorId: paymentData.tutorId, baseAmount: paymentData.baseAmount, transactionFee: paymentData.transactionFee, customerTotal: paymentData.customerTotal } });
  if (paymentData.tutorId && paymentData.tutorEmail) await createPortalNotification({ recipientId: paymentData.tutorId, email: paymentData.tutorEmail, title: "Student payment received", message: `${paymentData.studentName || "An assigned student"} has paid ${paymentData.plan}. ₦${paymentData.baseAmount.toLocaleString()} has been credited to your staff wallet.`, type: "STUDENT_PAYMENT", data: { paymentId: reference, studentId: paymentData.studentId, amount: paymentData.baseAmount } });
  return { created: true, payment: paymentData };
}
