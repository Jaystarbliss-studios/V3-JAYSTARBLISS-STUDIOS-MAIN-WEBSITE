import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";
import { getPaymentConfig, getUserRecord, normaliseRole, isPrivilegedRole, isActiveRecord } from "../../api/_lib/billing";
import { FieldValue } from "firebase-admin/firestore";
import { createPortalNotification } from "../../api/_lib/email";

const tokenFromEvent = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};
const response = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return response(405, { error: "Method Not Allowed" });
  try {
    const token = tokenFromEvent(event);
    if (!token) return response(401, { error: "Authentication required." });
    const decoded = await adminAuth.verifyIdToken(token);
    const adminUser = await getUserRecord(decoded.uid);
    const adminRole = normaliseRole(adminUser.role);
    if (!isPrivilegedRole(adminRole) || !isActiveRecord(adminUser)) return response(403, { error: "Administrator privileges are required." });

    const body = JSON.parse(event.body || "{}");
    const action = String(body.action || "").toLowerCase();
    const configRef = adminDb.collection("payment_config").doc("settings");

    if (action === "update_plan") {
      if (adminRole !== "superadmin") return response(403, { error: "Only the super admin can change payment fees or plans." });
      const planId = String(body.planId || "").trim();
      const baseAmount = Number(body.baseAmount);
      const durationWeeks = Number(body.durationWeeks);
      const name = String(body.name || "").trim();
      if (!planId || !Number.isFinite(baseAmount) || baseAmount < 0 || !Number.isFinite(durationWeeks) || durationWeeks < 1 || !name) return response(400, { error: "Plan name, base amount and duration are required." });
      const config = await getPaymentConfig();
      if (!config.plans[planId]) return response(404, { error: "Payment plan was not found." });
      await configRef.set({
        version: Number(config.version || 2),
        plans: { ...config.plans, [planId]: { ...config.plans[planId], name, baseAmount, durationWeeks, teachingModes: Array.isArray(body.teachingModes) ? body.teachingModes : config.plans[planId].teachingModes, active: body.active !== false } },
        updatedBy: decoded.uid,
        updatedAt: new Date()
      }, { merge: true });
      return response(200, { updated: true });
    }

    if (action === "update_fee_policy") {
      if (adminRole !== "superadmin") return response(403, { error: "Only the super admin can change transaction fee settings." });
      const role = String(body.role || "parent").toLowerCase();
      if (role !== "parent" && role !== "school") return response(400, { error: "Fee policy role must be parent or school." });
      const percentage = Number(body.percentage);
      const flat = Number(body.flat);
      const cap = Number(body.cap);
      const waiveFlatBelow = Number(body.waiveFlatBelow);
      if (![percentage, flat, cap, waiveFlatBelow].every(Number.isFinite) || percentage < 0 || flat < 0 || cap < 0 || waiveFlatBelow < 0) return response(400, { error: "Fee policy values must be valid non-negative numbers." });
      const config = await getPaymentConfig();
      const key = role === "school" ? "schoolFeePolicy" : "parentFeePolicy";
      await configRef.set({ [key]: { percentage, flat, cap, waiveFlatBelow, enabled: body.enabled !== false }, updatedBy: decoded.uid, updatedAt: new Date() }, { merge: true });
      return response(200, { updated: true });
    }

    if (action === "set_minimum_withdrawal") {
      if (adminRole !== "superadmin") return response(403, { error: "Only the super admin can change wallet withdrawal rules." });
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) return response(400, { error: "Invalid minimum withdrawal amount." });
      await configRef.set({ minimumWithdrawalAmount: amount, updatedBy: decoded.uid, updatedAt: new Date() }, { merge: true });
      return response(200, { updated: true });
    }

    if (action === "assign_tutor") {
      const tutorId = String(body.tutorId || "").trim();
      const enrollmentRequestId = String(body.enrollmentRequestId || "").trim();
      const paymentId = String(body.paymentId || "").trim();
      if (!tutorId || (!enrollmentRequestId && !paymentId)) return response(400, { error: "Tutor and payment/enrollment context are required." });

      const tutorSnap = await adminDb.collection("users").doc(tutorId).get();
      if (!tutorSnap.exists) return response(404, { error: "Selected tutor account was not found." });
      const tutor = tutorSnap.data() || {};
      const tutorRole = normaliseRole(tutor.role);
      if (!isActiveRecord(tutor) || !["tutor", "staff"].includes(tutorRole)) return response(400, { error: "Only active tutor/staff accounts can be assigned." });

      let resolvedPaymentId = paymentId;
      let resolvedEnrollmentId = enrollmentRequestId;
      let studentId = String(body.studentId || "").trim();
      if (!resolvedPaymentId && resolvedEnrollmentId) {
        const enrollment = await adminDb.collection("enrollment_requests").doc(resolvedEnrollmentId).get();
        if (!enrollment.exists) return response(404, { error: "Enrollment request was not found." });
        resolvedPaymentId = String(enrollment.data()?.paymentReference || "");
        studentId = studentId || String(enrollment.data()?.studentId || "");
      }
      if (!resolvedPaymentId) return response(400, { error: "The selected enrollment does not have a recorded payment yet." });

      const paymentRef = adminDb.collection("payments").doc(resolvedPaymentId);
      const paymentSnapshot = await paymentRef.get();
      if (!paymentSnapshot.exists) return response(404, { error: "Payment record was not found." });
      const payment = paymentSnapshot.data() || {};
      if (String(payment.tutorId || "").trim() && String(payment.tutorId) !== tutorId) return response(409, { error: "This payment is already assigned to another tutor. Reassignment must be handled by an administrator." });

      const existingTutorId = String(payment.tutorId || "").trim();
      if (existingTutorId === tutorId) return response(200, { assigned: true, alreadyAssigned: true });

      const baseAmount = Number(payment.baseAmount || (Number(payment.amount || 0) / 100));
      const paymentStatus = String(payment.status || "").toUpperCase();
      const studentTargets = ["individualStudents", "students"].map(collectionName => adminDb.collection(collectionName).doc(studentId));
      const enrollmentRef = resolvedEnrollmentId ? adminDb.collection("enrollment_requests").doc(resolvedEnrollmentId) : null;

      await adminDb.runTransaction(async (transaction) => {
        const targetSnaps = await Promise.all(studentTargets.map(ref => transaction.get(ref)));
        transaction.update(paymentRef, {
          tutorId,
          tutorName: tutor.name || tutor.displayName || tutor.email || tutorId,
          tutorEmail: tutor.email || "",
          tutorAssignedAt: new Date(),
          tutorAssignedBy: decoded.uid
        });
        if (enrollmentRef) {
          transaction.set(enrollmentRef, {
            tutorId,
            tutorName: tutor.name || tutor.displayName || tutor.email || tutorId,
            tutorEmail: tutor.email || "",
            assignedAt: new Date(),
            assignedBy: decoded.uid
          }, { merge: true });
        }
        targetSnaps.forEach((snap) => {
          if (snap.exists) transaction.set(snap.ref, {
            tutorId,
            assignedTutorId: tutorId,
            assignedTutorName: tutor.name || tutor.displayName || tutor.email || tutorId,
            portalAccessEnabled: true,
            updatedAt: new Date()
          }, { merge: true });
        });
        if (paymentStatus === "PAID" && baseAmount > 0) {
          transaction.set(adminDb.collection("staffWallets").doc(tutorId), {
            availableBalance: FieldValue.increment(baseAmount),
            lifetimeEarned: FieldValue.increment(baseAmount),
            updatedAt: new Date()
          }, { merge: true });
        }
      });

      await createPortalNotification({
        recipientId: tutorId,
        email: tutor.email,
        title: "New student assignment",
        message: `${payment.enrollmentStudentName || payment.studentName || "A student"} has been assigned to you. Their paid plan and teaching details are available in your staff dashboard.`,
        type: "STUDENT_ASSIGNMENT",
        data: { studentId, paymentId: resolvedPaymentId, enrollmentRequestId: resolvedEnrollmentId || null }
      });
      return response(200, { assigned: true, tutorId, studentId: studentId || null });
    }

    return response(400, { error: "Unsupported billing administrator action." });
  } catch (error) {
    console.error("Billing administrator action failed:", error);
    return response(500, { error: "Unable to complete this billing administration request." });
  }
};
