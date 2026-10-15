import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body)
});
const normalise = (value: unknown) => String(value || "").trim().toLowerCase();
const adminRoles = new Set(["super_admin", "superadmin", "admin"]);

export const handler: Handler = async event => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  try {
    const header = event.headers?.authorization || event.headers?.Authorization || "";
    if (!header.startsWith("Bearer ")) return json(401, { error: "Authentication required." });
    const decoded = await adminAuth.verifyIdToken(header.slice(7));
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) return json(403, { error: "Portal profile not found." });
    const user = userSnap.data() || {};
    const role = normalise(user.role);
    if (!["parent", "student"].includes(role)) return json(403, { error: "This registration type is not eligible for this notification." });

    const adminSnap = await adminDb.collection("users").limit(1000).get();
    const recipients = adminSnap.docs.filter(d => adminRoles.has(normalise(d.data().role)));
    if (!recipients.length) return json(200, { ok: true, notified: 0 });

    const batch = adminDb.batch();
    const now = FieldValue.serverTimestamp();
    for (const admin of recipients) {
      const ref = adminDb.collection("notifications").doc(`registration-${decoded.uid}-${admin.id}`);
      batch.set(ref, {
        recipientId: admin.id,
        recipientType: "specific_user",
        type: "system",
        priority: "normal",
        title: role === "parent" ? "New parent registration" : "New student registration",
        message: `${String(user.name || user.fullName || user.email || "A new user")} registered for a ${role} portal account.`,
        targetUid: decoded.uid,
        targetRole: role,
        targetName: String(user.name || user.fullName || ""),
        targetEmail: String(user.email || decoded.email || ""),
        readBy: [],
        read: false,
        timestamp: now,
        createdAt: now,
        senderName: "Jaystarbliss Central",
        senderRole: "System"
      }, { merge: true });
    }
    await batch.commit();
    return json(200, { ok: true, notified: recipients.length });
  } catch (error) {
    console.error("Admin registration notification failed:", error);
    return json(500, { error: "Unable to notify administration." });
  }
};
