import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const ADMIN_ROLES = new Set([
  "super_admin",
  "content_admin",
  "education_admin",
  "services_admin",
]);

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const idToken = String(body.idToken || "").trim();
    if (!idToken) return json(400, { error: "Google authentication token is required." });

    // The browser must first authenticate with Google. We then verify the
    // resulting Firebase ID token on the server before considering any admin role.
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const provider = String(decoded.firebase?.sign_in_provider || "");
    const email = String(decoded.email || "").trim().toLowerCase();

    if (provider !== "google.com" || !email || decoded.email_verified !== true) {
      return json(403, { error: "A verified Google account is required for administrator access." });
    }

    // Never trust the Google UID as an administrator merely because the email matches.
    // Resolve the authoritative administrator account already provisioned by JBS.
    const targetAuth = await adminAuth.getUserByEmail(email);
    const targetSnap = await adminDb.collection("users").doc(targetAuth.uid).get();
    if (!targetSnap.exists) return json(403, { error: "No administrator profile is associated with this account." });

    const target = targetSnap.data() || {};
    const role = String(target.role || "").toLowerCase();
    const accountStatus = String(target.accountStatus || target.status || "ACTIVE").toUpperCase();

    if (!ADMIN_ROLES.has(role)) {
      return json(403, { error: "This Google account is not enabled for administrator access." });
    }
    if (["DISABLED", "SUSPENDED", "BANNED"].includes(accountStatus) || targetAuth.disabled) {
      return json(403, { error: "This administrator account is currently disabled." });
    }

    const customToken = await adminAuth.createCustomToken(targetAuth.uid);

    await adminDb.collection("activityLogs").add({
      action: "ADMIN_GOOGLE_LOGIN",
      actorId: targetAuth.uid,
      actorRole: role,
      targetEmail: email,
      googleAuthUid: decoded.uid,
      createdAt: new Date(),
    });

    return json(200, {
      success: true,
      customToken,
      userId: targetAuth.uid,
      role,
      name: target.name || targetAuth.displayName || "Admin",
      email: targetAuth.email || email,
    });
  } catch (error: any) {
    console.error("Admin Google login error:", error);
    return json(401, { error: "Google administrator authentication could not be completed." });
  }
};
