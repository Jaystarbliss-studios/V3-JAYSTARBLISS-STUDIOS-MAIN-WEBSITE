import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";
import { getPaymentConfig, getUserRecord, normaliseRole, isPrivilegedRole, isStaffRole, isActiveRecord } from "../../api/_lib/billing";

const tokenFromEvent = (event: any) => { const header = event.headers?.authorization || event.headers?.Authorization || ""; return header.startsWith("Bearer ") ? header.slice(7) : ""; };
const plain = (value: any): any => { if (value === null || value === undefined) return value; if (value instanceof Date) return value.toISOString(); if (typeof value?.toDate === "function") return value.toDate().toISOString(); if (typeof value?.seconds === "number") return new Date(value.seconds * 1000).toISOString(); if (Array.isArray(value)) return value.map(plain); if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, plain(val)])); return value; };
const docs = async (collectionName: string, field: string, value: string, limitCount = 100) => { const snap = await adminDb.collection(collectionName).where(field, "==", value).limit(limitCount).get(); return snap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })); };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const token = tokenFromEvent(event); if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Authentication required." }) };
    const decoded = await adminAuth.verifyIdToken(token); const user = await getUserRecord(decoded.uid); const role = normaliseRole(user.role);
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
      const staffMap = new Map<string, any>();
      [...usersTutorSnap.docs, ...usersStaffSnap.docs].forEach(doc => { const data = doc.data(); staffMap.set(doc.id, { id: doc.id, name: data.name || data.displayName || data.email || doc.id, email: data.email || "", role: normaliseRole(data.role), accountStatus: data.accountStatus || "ACTIVE" }); });
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        role, config,
        payments: paymentsSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })),
        enrollments: enrollmentSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })),
        withdrawals: withdrawalsSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })),
        staff: Array.from(staffMap.values()).filter(item => isActiveRecord(item))
      }) };
    }
    if (isStaffRole(role)) {
      const tutorPayments = await docs("payments", "tutorId", decoded.uid, 100); const studentMap = new Map<string, any>();
      for (const field of ["tutorId", "staffId", "assignedTutorId", "assignedStaffId", "instructorId"]) for (const collectionName of ["individualStudents", "students"]) { try { const records = await docs(collectionName, field, decoded.uid, 100); records.forEach(record => studentMap.set(record.id, record)); } catch (error) { console.warn(`Assigned ${collectionName}/${field} lookup failed:`, error); } }
      const walletSnap = await adminDb.collection("staffWallets").doc(decoded.uid).get(); const withdrawalSnap = await adminDb.collection("walletWithdrawals").where("staffId", "==", decoded.uid).limit(25).get();
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, config, payments: tutorPayments, students: Array.from(studentMap.values()), wallet: walletSnap.exists ? plain(walletSnap.data()) : { availableBalance: 0, reservedBalance: 0, lifetimeEarned: 0 }, withdrawals: withdrawalSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })) }) };
    }
    const schoolId = role === "school" ? String((user as any).schoolId || "") || decoded.uid : "";
    const payments = role === "parent" ? await docs("payments", "parentId", decoded.uid, 100) : role === "school" ? await docs("payments", "schoolId", schoolId, 100) : await docs("payments", "userId", decoded.uid, 100);
    const enrollments = role === "parent" ? await docs("enrollment_requests", "parentId", decoded.uid, 100) : role === "school" ? await docs("enrollment_requests", "schoolId", schoolId, 100) : [];
    const students = role === "parent" ? [...await docs("individualStudents", "parentId", decoded.uid, 100), ...await docs("students", "parentId", decoded.uid, 100)] : role === "school" ? [...await docs("individualStudents", "schoolId", schoolId, 100), ...await docs("students", "schoolId", schoolId, 100)] : [];
    const notificationSnap = await adminDb.collection("notifications").where("recipientId", "==", decoded.uid).limit(25).get();
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, config, payments, enrollments, students, notifications: notificationSnap.docs.map(doc => ({ id: doc.id, ...plain(doc.data()) })) }) };
  } catch (error) { console.error("Billing data lookup failed:", error); return { statusCode: 500, body: JSON.stringify({ error: "Unable to load billing records." }) }; }
};
