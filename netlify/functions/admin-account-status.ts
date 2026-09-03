import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const ADMIN_ROLES = new Set(["super_admin", "content_admin", "education_admin", "services_admin"]);
const STATUS_VALUES = new Set(["ACTIVE", "SUSPENDED", "BANNED", "DISABLED"]);

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

    if (!ADMIN_ROLES.has(callerRole)) {
      return json(403, { error: "Administrator permissions are required." });
    }

    const body = JSON.parse(event.body || "{}");
    const userId = String(body.userId || "").trim();
    const status = String(body.status || "").trim().toUpperCase();

    if (!userId || !STATUS_VALUES.has(status)) {
      return json(400, { error: "A valid userId and account status are required." });
    }

    if (userId === decoded.uid && status !== "ACTIVE") {
      return json(400, { error: "You cannot suspend, ban, or disable your own administrator account." });
    }

    const targetUser = await adminAuth.getUser(userId);
    const targetProfileSnap = await adminDb.collection("users").doc(userId).get();
    const targetProfile = targetProfileSnap.exists ? targetProfileSnap.data() || {} : {};
    const targetRole = String(targetProfile.role || "").toLowerCase();

    if (targetRole === "super_admin" && callerRole !== "super_admin") {
      return json(403, { error: "Only a Super Admin can change another Super Admin's account state." });
    }

    const disabled = status !== "ACTIVE";
    await adminAuth.updateUser(userId, { disabled });

    const now = new Date();
    const userUpdate: Record<string, unknown> = {
      accountStatus: status,
      updatedAt: now,
    };
    if (disabled) userUpdate.disabledAt = now;

    await adminDb.collection("users").doc(userId).set(userUpdate, { merge: true });

    const profileUpdates: Record<string, unknown> = { accountStatus: status, updatedAt: now };
    if (disabled) profileUpdates.disabledAt = now;

    if (targetRole === "staff" || targetRole === "tutor" || targetRole === "instructor") {
      await adminDb.collection("tutors").doc(userId).set(profileUpdates, { merge: true });
    } else if (targetRole === "student") {
      await adminDb.collection("individualStudents").doc(userId).set(profileUpdates, { merge: true });
    } else if (targetRole === "parent") {
      await adminDb.collection("parents").doc(userId).set(profileUpdates, { merge: true });
    } else if (targetRole === "school") {
      await adminDb.collection("schools").doc(userId).set(profileUpdates, { merge: true });
    } else if (targetRole.includes("admin")) {
      await adminDb.collection("admins").doc(userId).set({ status, updatedAt: now, ...(disabled ? { disabledAt: now } : {}) }, { merge: true });
    }

    return json(200, {
      success: true,
      userId,
      status,
      disabled,
      email: targetUser.email || null,
    });
  } catch (error: any) {
    console.error("Admin account status error:", error);
    const message = error?.code === "auth/user-not-found"
      ? "Firebase Auth user not found."
      : "Unable to update account access securely.";
    return json(error?.code === "auth/user-not-found" ? 404 : 500, { error: message });
  }
};
