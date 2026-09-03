import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const authorization = event.headers.authorization || "";
    if (!authorization.startsWith("Bearer ")) {
      return { statusCode: 401, body: JSON.stringify({ error: "Authentication required" }) };
    }

    const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
    const body = JSON.parse(event.body || "{}");
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const adminSnap = await adminDb.collection("admins").doc(decoded.uid).get();

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const adminData = adminSnap.exists ? adminSnap.data() || {} : {};
    const role = String(userData.role || adminData.role || "USER").toUpperCase();

    await adminDb.collection("activityLogs").add({
      actorUid: decoded.uid,
      type: "login",
      userType: role,
      role,
      timestamp: new Date()
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recorded: true })
    };
  } catch (error) {
    console.error("Activity telemetry error:", error);
    return { statusCode: 401, body: JSON.stringify({ error: "Unable to record activity" }) };
  }
};
