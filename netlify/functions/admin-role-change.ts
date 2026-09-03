import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const ADMIN_ROLES = new Set(["super_admin", "content_admin", "education_admin", "services_admin"]);
const ROLE_ALIASES: Record<string, string> = {
  USER: "user",
  STUDENT: "student",
  PARENT: "parent",
  TUTOR: "staff",
  STAFF: "staff",
  INSTRUCTOR: "staff",
  SCHOOL: "school",
  CONTENT_ADMIN: "content_admin",
  EDUCATION_ADMIN: "education_admin",
  SERVICES_ADMIN: "services_admin",
  SUPER_ADMIN: "super_admin"
};

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

const getToken = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  try {
    const token = getToken(event);
    if (!token) return json(401, { error: "Authentication required." });
    const decoded = await adminAuth.verifyIdToken(token);
    const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const caller = callerSnap.exists ? callerSnap.data() || {} : {};
    const callerRole = String(caller.role || "").toLowerCase();
    const callerStatus = String(caller.accountStatus || "ACTIVE").toLowerCase();
    if (!ADMIN_ROLES.has(callerRole) || ["disabled", "suspended", "banned"].includes(callerStatus)) {
      return json(403, { error: "Administrator permissions are required." });
    }

    const body = JSON.parse(event.body || "{}");
    const userId = String(body.userId || "").trim();
    const requestedRole = String(body.role || "").trim().toUpperCase();
    const role = ROLE_ALIASES[requestedRole];
    if (!userId || !role) return json(400, { error: "A valid userId and role are required." });
    if (userId === decoded.uid && role !== "super_admin") return json(400, { error: "You cannot remove your own administrator role." });

    const targetAuth = await adminAuth.getUser(userId);
    const targetSnap = await adminDb.collection("users").doc(userId).get();
    const target = targetSnap.exists ? targetSnap.data() || {} : {};
    const targetRole = String(target.role || "").toLowerCase();
    const targetStatus = String(target.accountStatus || "ACTIVE").toUpperCase();

    if ((role === "super_admin" || targetRole === "super_admin") && callerRole !== "super_admin") {
      return json(403, { error: "Only a Super Admin can create or modify Super Admin access." });
    }
    if (["content_admin", "education_admin", "services_admin"].includes(role) && callerRole !== "super_admin") {
      return json(403, { error: "Only a Super Admin can assign administrative roles." });
    }

    const now = new Date();
    await adminDb.collection("users").doc(userId).set({ role, updatedAt: now }, { merge: true });

    if (role === "staff") {
      await adminDb.collection("tutors").doc(userId).set({ role: "staff", updatedAt: now }, { merge: true });
    } else if (role === "parent") {
      await adminDb.collection("parents").doc(userId).set({ role: "parent", updatedAt: now }, { merge: true });
    } else if (role === "student") {
      await adminDb.collection("individualStudents").doc(userId).set({ role: "student", updatedAt: now }, { merge: true });
    } else if (role === "school") {
      await adminDb.collection("schools").doc(userId).set({ updatedAt: now }, { merge: true });
    } else if (role.includes("admin")) {
      await adminDb.collection("admins").doc(userId).set({ uid: userId, email: targetAuth.email || null, name: target.name || targetAuth.displayName || "", role, status: targetStatus, updatedAt: now }, { merge: true });
    }

    await adminDb.collection("activityLogs").add({
      action: "USER_ROLE_CHANGED",
      actorId: decoded.uid,
      actorRole: callerRole,
      targetUserId: userId,
      targetEmail: targetAuth.email || null,
      previousRole: targetRole,
      nextRole: role,
      createdAt: now,
    });

    return json(200, { success: true, userId, role, email: targetAuth.email || null });
  } catch (error: any) {
    console.error("Admin role change error:", error);
    return json(error?.code === "auth/user-not-found" ? 404 : 500, { error: error?.code === "auth/user-not-found" ? "Firebase Auth user not found." : "Unable to update the user role securely." });
  }
};
