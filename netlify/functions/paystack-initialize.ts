import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";
import { calculateCustomerCharge, getFeePolicy, getPaymentConfig, getUserRecord, normaliseRole, isActiveRecord } from "../../api/_lib/billing";

const token = (event: any) => { const header = event.headers?.authorization || event.headers?.Authorization || ""; return header.startsWith("Bearer ") ? header.slice(7) : ""; };
const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const findStudent = async (studentId: string, ownerId: string, ownerType: "parent" | "school") => {
  if (!studentId) return null;
  for (const name of ["individualStudents", "students"]) {
    const snap = await adminDb.collection(name).doc(studentId).get();
    if (!snap.exists) continue;
    const student = snap.data() || {};
    const owned = ownerType === "parent" ? String(student.parentId || "") === ownerId : String(student.schoolId || "") === ownerId;
    if (!owned) throw new Error("STUDENT_OWNER_MISMATCH");
    return { id: snap.id, ...student };
  }
  throw new Error("STUDENT_NOT_FOUND");
};
const derivePlanId = (value: unknown) => { const text = String(value || "").toLowerCase(); if (text.includes("intensive") || text.includes("1-on-1") || text.includes("mentorship")) return "plan_mentorship"; if (text.includes("robotic") || text.includes("iot") || text.includes("hardware") || text.includes("ai")) return "plan_robotics"; if (text.includes("school") && text.includes("cbt")) return "school_cbt"; return "plan_weekend"; };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  try {
    const authToken = token(event); if (!authToken) return json(401, { error: "Authentication required." });
    const decoded = await adminAuth.verifyIdToken(authToken);
    const user = await getUserRecord(decoded.uid); if (!isActiveRecord(user) || !user.role) return json(403, { error: "An active portal profile is required before making a payment." });
    const actualRole = normaliseRole(user.role);
    const body = JSON.parse(event.body || "{}"); const requestedRole = String(body.role || actualRole).toLowerCase();
    if (requestedRole !== actualRole) return json(403, { error: "Payment role does not match your active portal role." });
    if (!["parent", "school", "student"].includes(actualRole)) return json(403, { error: "This account is not eligible to make tuition payments." });

    const config = await getPaymentConfig();
    let planId = String(body.planId || "").trim();
    const enrollmentRequestId = String(body.enrollmentRequestId || "").trim();
    let enrollment: Record<string, any> | null = null;
    let student: Record<string, any> | null = null;
    let studentId = String(body.studentId || "").trim();

    if (enrollmentRequestId) {
      if (actualRole !== "parent") return json(400, { error: "Enrollment-linked payments are available to parents only." });
      const snap = await adminDb.collection("enrollment_requests").doc(enrollmentRequestId).get();
      if (!snap.exists) return json(404, { error: "Enrollment request could not be found." });
      enrollment = snap.data() || {};
      if (String(enrollment.parentId || "") !== decoded.uid) return json(403, { error: "You are not authorized to pay for this enrollment." });
      if (String(enrollment.paymentStatus || "").toUpperCase() === "PAID") return json(409, { error: "This enrollment has already been paid." });
      planId = planId || String(enrollment.planId || "").trim() || derivePlanId(enrollment.plan);
      studentId = studentId || String(enrollment.studentId || "").trim();
    }

    const plan = config.plans[planId];
    if (!plan || !plan.active) return json(400, { error: "The selected payment plan is unavailable." });
    if (actualRole === "school" && plan.role !== "school") return json(400, { error: "Please select a school payment plan." });
    if (actualRole !== "school" && plan.role !== "student") return json(400, { error: "Please select a parent/student payment plan." });
    if (actualRole === "parent" && !studentId && !enrollmentRequestId) return json(400, { error: "Select the child this parent payment is for." });

    if (actualRole === "parent" && studentId) student = await findStudent(studentId, decoded.uid, "parent");
    if (actualRole === "school") {
      const schoolId = String((user as any).schoolId || decoded.uid);
      if (studentId) student = await findStudent(studentId, schoolId, "school");
    }
    if (actualRole === "student") {
      studentId = studentId || String((user as any).studentDocId || "");
      if (!studentId || !String((user as any).studentDocId || "")) return json(403, { error: "Your student profile is not ready for billing." });
      const studentLookup = await adminDb.collection("individualStudents").doc(studentId).get();
      if (!studentLookup.exists || String(studentLookup.data()?.firebaseUid || studentLookup.data()?.userId || "") !== decoded.uid) return json(403, { error: "Your student profile could not be verified." });
      student = { id: studentLookup.id, ...studentLookup.data() };
    }

    const teachingMode = String(body.teachingMode || enrollment?.teachingMode || enrollment?.modeOfTeaching || student?.teachingMode || plan.teachingModes[0] || "Standard delivery").trim();
    const durationWeeks = actualRole === "school" ? Math.max(1, Number(body.durationWeeks || enrollment?.durationWeeks || plan.durationWeeks)) : 4;
    const tutorId = String(enrollment?.tutorId || student?.tutorId || student?.staffId || student?.assignedTutorId || student?.assignedStaffId || student?.instructorId || "").trim();
    const schoolId = actualRole === "school" ? String((user as any).schoolId || decoded.uid) : String(student?.schoolId || "").trim();
    const feeRole = actualRole === "school" ? "school" : "parent";
    const charge = calculateCustomerCharge(plan.baseAmount, getFeePolicy(config, feeRole));
    const paymentMethod = String(body.paymentMethod || "card").toLowerCase();
    if (!["card", "bank_transfer"].includes(paymentMethod)) return json(400, { error: "Unsupported payment method." });
    if (!process.env.PAYSTACK_SECRET_KEY) return json(503, { error: "Payment gateway is not configured." });
    const callbackRoot = process.env.PUBLIC_APP_URL; if (!callbackRoot) return json(500, { error: "Payment callback is not configured." });
    const callbackPath = actualRole === "school" ? "/portal/school/payments" : actualRole === "parent" ? "/portal/parent/payments" : "/portal/student/payments";

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: decoded.email, amount: Math.round(charge.totalAmount * 100), currency: "NGN", callback_url: `${callbackRoot.replace(/\/$/, "")}${callbackPath}`, channels: [paymentMethod], metadata: { userId: decoded.uid, role: actualRole, planRole: plan.role, planId, planName: plan.name, baseAmount: charge.baseAmount, transactionFee: charge.transactionFee, customerTotal: charge.totalAmount, durationWeeks, teachingMode, studentId: studentId || null, studentName: student?.fullName || student?.studentName || enrollment?.studentName || null, tutorId: tutorId || null, enrollmentRequestId: enrollmentRequestId || null, schoolId: schoolId || null, paymentMethod } })
    });
    const data = await response.json();
    if (!response.ok || !data.status || !data.data?.authorization_url) { console.error("Paystack initialization failed:", data); return json(502, { error: "Unable to initialize payment." }); }

    if (enrollmentRequestId) await adminDb.collection("enrollment_requests").doc(enrollmentRequestId).set({ planId, teachingMode, durationWeeks, paymentPlanName: plan.name, paymentBaseAmount: charge.baseAmount, paymentTransactionFee: charge.transactionFee, paymentTotal: charge.totalAmount, studentId: studentId || null, tutorId: tutorId || null, schoolId: schoolId || null, paymentReference: data.data.reference, paymentStatus: "PENDING", updatedAt: new Date() }, { merge: true });
    return json(200, { authorizationUrl: data.data.authorization_url, reference: data.data.reference, planId, planName: plan.name, baseAmount: charge.baseAmount, transactionFee: charge.transactionFee, totalAmount: charge.totalAmount, durationWeeks, teachingMode, studentId: studentId || null, tutorId: tutorId || null });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "STUDENT_OWNER_MISMATCH") return json(403, { error: "That student is not linked to your account." });
    if (code === "STUDENT_NOT_FOUND") return json(404, { error: "The selected student could not be found." });
    console.error("Payment initialization error:", error); return json(500, { error: "Unable to authenticate or initialize this payment." });
  }
};
