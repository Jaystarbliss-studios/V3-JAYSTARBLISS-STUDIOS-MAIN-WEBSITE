import type { Handler } from "@netlify/functions";
import { adminAuth } from "../../api/_lib/firebase-admin";
import { getPaymentConfig, getUserRecord, normaliseRole } from "../../api/_lib/billing";

const tokenFromEvent = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const token = tokenFromEvent(event);
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Authentication required." }) };
    const decoded = await adminAuth.verifyIdToken(token);
    const user = await getUserRecord(decoded.uid);
    const role = normaliseRole(user.role);
    if (!["student", "parent", "school", "tutor", "staff", "admin", "superadmin"].includes(role)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Billing access is not available for this account." }) };
    }
    const config = await getPaymentConfig();
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) };
  } catch (error) {
    console.error("Payment config lookup failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to load payment configuration." }) };
  }
};
