import type { Handler } from "@netlify/functions";
import { adminAuth } from "../../api/_lib/firebase-admin";
import { getUserRecord, normaliseRole, isStaffRole } from "../../api/_lib/billing";

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
    if (!isStaffRole(normaliseRole(user.role))) return { statusCode: 403, body: JSON.stringify({ error: "Bank lookup is available to staff accounts only." }) };
    const response = await fetch("https://api.paystack.co/bank?country=nigeria&currency=NGN&perPage=100", {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ""}` }
    });
    const data = await response.json();
    if (!response.ok || !data.status) return { statusCode: 502, body: JSON.stringify({ error: "Unable to load supported banks." }) };
    const banks = (Array.isArray(data.data) ? data.data : []).map((bank: any) => ({ name: String(bank.name || ""), code: String(bank.code || "") })).filter((bank: any) => bank.name && bank.code);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banks }) };
  } catch (error) {
    console.error("Paystack bank lookup failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to load bank list." }) };
  }
};
