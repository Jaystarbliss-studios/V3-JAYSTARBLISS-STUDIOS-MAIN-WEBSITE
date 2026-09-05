import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";
import { getPaymentConfig, getUserRecord, normaliseRole, isPrivilegedRole, isStaffRole, isActiveRecord } from "../../api/_lib/billing";

const tokenFromEvent = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};
const plain = (value: any): any => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, plain(val)]));
  return value;
};
const docs = async (collectionName: string, field: string, value: string, limitCount = 100) => {
  const snap = await adminDb.collection(collectionName).where(field, "==", value).limit(limitCount).get();
  return snap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) }));
};
const safeStudent = (record: any) => {
  const { accessCode, passcode, accessCodeHash, credentialIssuedAt, credentialIssuedBy, ...safe } = record || {};
  return safe;
};
const staffAssignmentFields = ["tutorId", "staffId", "assignedTutorId", "assignedStaffId", "instructorId"];
const assignedStudentRecords = async (uid: string) => {
  const studentMap = new Map<string, any>();
  for (const field of staffAssignmentFields) {
    for (const collectionName of ["individualStudents", "students"]) {
      try {
        const records = await docs(collectionName, field, uid, 100);
        records.forEach(record => studentMap.set(record.id, safeStudent(record)));
      } catch (error) {
        console.warn(`Assigned ${collectionName}/${field} lookup failed:`, error);
      }
    }
  }
  return Array.from(studentMap.values());
};
const staffPayments = async (uid: string) => {
  const paymentMap = new Map<string, any>();
  for (const field of staffAssignmentFields) {
    try {
      const records = await docs("payments", field, uid, 100);
      records.forEach(record => paymentMap.set(record.id, record));
    } catch (error) {
      console.warn(`Payment ${field} lookup failed:`, error);
    }
  }
  return Array.from(paymentMap.values());
};
const numericAmount = (payment: any) => {
  for (const candidate of [payment.customerTotal, payment.totalAmount, payment.amountPaid, payment.amount, payment.grossAmount]) {
    const amount = Number(candidate);
    if (Number.isFinite(amount) && amount >= 0) return amount;
  }
  return 0;
};
const paymentDate = (payment: any) => {
  const value = payment.paidAt || payment.paymentDate || payment.createdAt || payment.updatedAt;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};
const isSuccessfulPayment = (payment: any) => {
  const status = String(payment.status || payment.paymentStatus || "").toUpperCase();
  return !status || ["SUCCESS", "SUCCESSFUL", "PAID", "COMPLETED", "APPROVED"].includes(status);
};
const billingSummary = (payments: any[]) => {
  const successful = payments.filter(isSuccessfulPayment).filter(p => numericAmount(p) > 0);
  const totalPaid = successful.reduce((sum, p) => sum + numericAmount(p), 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = successful.reduce((sum, p) => {
    const date = paymentDate(p);
    return date && date >= monthStart ? sum + numericAmount(p) : sum;
  }, 0);
  const latest = successful.map(payment => ({ payment, date: paymentDate(payment) })).filter(item => item.date).sort((a, b) => b.date!.getTime() - a.date!.getTime())[0];
  const lastPaidAt = latest?.date || null;
  const nextPaymentDue = lastPaidAt ? new Date(lastPaidAt.getTime() + 28 * 24 * 60 * 60 * 1000) : null;
  const transactionFees = successful.reduce((sum, p) => {
    const fee = Number(p.transactionFee ?? p.gatewayFee ?? p.paystackFee ?? 0);
    return sum + (Number.isFinite(fee) && fee >= 0 ? fee : 0);
  }, 0);
  return {
    totalPaid,
    monthlyRevenue,
    transactionFees,
    paymentCount: successful.length,
    lastPaidAt: lastPaidAt?.toISOString() || null,
    nextPaymentDue: nextPaymentDue?.toISOString() || null,
    paymentCycleDays: 28,
    overdue: Boolean(nextPaymentDue && nextPaymentDue.getTime() < now.getTime())
  };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const token = tokenFromEvent(event);
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Authentication required." }) };
    const decoded = await adminAuth.verifyIdToken(token);
    const user = await getUserRecord(decoded.uid);
    const role = normaliseRole(user.role);
    if (!isActiveRecord(user)) return { statusCode: 403, body: JSON.stringify({ error: "Your account is not active." }) };
    const config = await getPaymentConfig();

    if (isPrivilegedRole(role)) {
      const [paymentsSnap, enrollmentSnap, usersTutorSnap, usersStaffSnap, withdrawalsSnap] = await Promise.all([
        adminDb.collection("payments").limit(500).get(),
        adminDb.collection("enrollment_requests").limit(200).get(),
        adminDb.collection("users").where("role", "in", ["TUTOR", "tutor", "INSTRUCTOR", "instructor"]).limit(100).get(),
        adminDb.collection("users").where("role", "in", ["STAFF", "staff"]).limit(100).get(),
        adminDb.collection("walletWithdrawals").limit(200).get()
      ]);
      const payments = paymentsSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) }));
      const staffMap = new Map<string, any>();
      [...usersTutorSnap.docs, ...usersStaffSnap.docs].forEach(doc => {
        const data = doc.data();
        staffMap.set(doc.id, { id: doc.id, name: data.name || data.displayName || data.email || doc.id, email: data.email || "", role: normaliseRole(data.role), accountStatus: data.accountStatus || "ACTIVE" });
      });
      return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ role, config, payments, billingSummary: billingSummary(payments), enrollments: enrollmentSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })), withdrawals: withdrawalsSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })), staff: Array.from(staffMap.values()).filter(item => isActiveRecord(item)) }) };
    }

    if (isStaffRole(role)) {
      const [payments, students, walletSnap, withdrawalSnap] = await Promise.all([
        staffPayments(decoded.uid),
        assignedStudentRecords(decoded.uid),
        adminDb.collection("staffWallets").doc(decoded.uid).get(),
        adminDb.collection("walletWithdrawals").where("staffId", "==", decoded.uid).limit(25).get()
      ]);
      return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ role, config, payments, billingSummary: billingSummary(payments), students, wallet: walletSnap.exists ? plain(walletSnap.data()) : { availableBalance: 0, reservedBalance: 0, lifetimeEarned: 0 }, withdrawals: withdrawalSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })) }) };
    }

    const schoolId = role === "school" ? String((user as any).schoolId || "") || decoded.uid : "";
    const payments = role === "parent" ? await docs("payments", "parentId", decoded.uid, 100) : role === "school" ? await docs("payments", "schoolId", schoolId, 100) : await docs("payments", "userId", decoded.uid, 100);
    const enrollments = role === "parent" ? await docs("enrollment_requests", "parentId", decoded.uid, 100) : role === "school" ? await docs("enrollment_requests", "schoolId", schoolId, 100) : [];
    const students = role === "parent" ? [...await docs("individualStudents", "parentId", decoded.uid, 100), ...await docs("students", "parentId", decoded.uid, 100)].map(safeStudent) : role === "school" ? [...await docs("individualStudents", "schoolId", schoolId, 100), ...await docs("students", "schoolId", schoolId, 100)].map(safeStudent) : [];
    const notificationSnap = await adminDb.collection("notifications").where("recipientId", "==", decoded.uid).limit(25).get();
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ role, config, payments, billingSummary: billingSummary(payments), enrollments, students, notifications: notificationSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })) }) };
  } catch (error) {
    console.error("Billing data lookup failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to load billing records." }) };
  }
};
