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
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return { statusCode: 503, body: JSON.stringify({ error: "Payment gateway is not configured." }) };
    }

    const banks: Array<{ name: string; code: string }> = [];
    const extractBanks = (data: any) => (Array.isArray(data?.data) ? data.data : [])
      .map((bank: any) => ({ name: String(bank.name || "").trim(), code: String(bank.code || "").trim() }))
      .filter((bank: any) => bank.name && bank.code);

    let nextCursor = "";
    for (let requestCount = 0; requestCount < 10; requestCount += 1) {
      const url = new URL("https://api.paystack.co/bank");
      url.searchParams.set("country", "nigeria");
      url.searchParams.set("currency", "NGN");
      url.searchParams.set("perPage", "100");
      url.searchParams.set("use_cursor", "true");
      if (nextCursor) url.searchParams.set("next", nextCursor);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      });
      const data = await response.json();
      if (!response.ok || !data.status) {
        console.error("Paystack bank directory error:", data);
        return { statusCode: 502, body: JSON.stringify({ error: "Unable to load supported banks." }) };
      }

      banks.push(...extractBanks(data));
      const cursor = String(data?.meta?.next || "").trim();
      if (!cursor || cursor === nextCursor || extractBanks(data).length === 0) break;
      nextCursor = cursor;
    }

    const uniqueBanks = Array.from(new Map(banks.map(bank => [bank.code + ":" + bank.name, bank])).values())
      .sort((a, b) => a.name.localeCompare(b.name));
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ banks: uniqueBanks }) };
  } catch (error) {
    console.error("Paystack bank lookup failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to load bank list." }) };
  }
};
