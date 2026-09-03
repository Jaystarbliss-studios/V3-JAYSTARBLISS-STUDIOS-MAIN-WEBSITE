import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const getToken = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const token = getToken(event);
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Authentication required." }) };
    const decoded = await adminAuth.verifyIdToken(token);
    const { reference } = JSON.parse(event.body || "{}");
    if (!reference || typeof reference !== "string" || reference.length > 200) {
      return { statusCode: 400, body: JSON.stringify({ error: "Payment reference is required." }) };
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const data = await response.json();
    if (!response.ok || !data.status || data.data?.status !== "success") {
      return { statusCode: 402, body: JSON.stringify({ error: "Payment has not been verified." }) };
    }

    const tx = data.data;
    const metadataUserId = tx.metadata?.userId;
    if (metadataUserId !== decoded.uid) {
      return { statusCode: 403, body: JSON.stringify({ error: "Payment ownership could not be verified." }) };
    }

    const existing = await adminDb.collection("payments").where("reference", "==", reference).limit(1).get();
    if (existing.empty) {
      await adminDb.collection("payments").add({
        userId: decoded.uid,
        email: decoded.email || tx.customer?.email || "",
        plan: tx.metadata?.planName || "Portal Renewal",
        planId: tx.metadata?.planId || "",
        amount: tx.amount,
        currency: tx.currency || "NGN",
        paymentMethod: tx.channel || "paystack",
        status: "PAID",
        reference,
        role: tx.metadata?.role || "student",
        description: `Tuition & Fee Renewal: ${tx.metadata?.planName || "Portal Renewal"}`,
        createdAt: new Date(),
        paidAt: tx.paid_at || null
      });
    }

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verified: true, reference }) };
  } catch (error) {
    console.error("Payment verification error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to verify payment." }) };
  }
};
