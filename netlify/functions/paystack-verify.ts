import type { Handler } from "@netlify/functions";
import { adminAuth } from "../../api/_lib/firebase-admin";
import { reconcileSuccessfulCharge } from "../../api/_lib/payment-reconciliation";

const getToken = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};
const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  try {
    const token = getToken(event);
    if (!token) return json(401, { error: "Authentication required." });
    const decoded = await adminAuth.verifyIdToken(token);
    const { reference } = JSON.parse(event.body || "{}");
    if (!reference || typeof reference !== "string" || reference.length > 200) return json(400, { error: "Payment reference is required." });
    if (!process.env.PAYSTACK_SECRET_KEY) return json(503, { error: "Payment gateway is not configured." });

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const data = await response.json();
    if (!response.ok || !data.status || String(data.data?.status || "").toLowerCase() !== "success") return json(402, { error: "Payment has not been verified." });

    const result = await reconcileSuccessfulCharge(data.data, decoded.uid);
    return json(200, { verified: true, reference, alreadyRecorded: !result.created });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const errors: Record<string, [number, string]> = {
      PAYMENT_METADATA_INVALID: [400, "Payment metadata could not be verified."],
      PAYMENT_OWNER_MISMATCH: [403, "Payment ownership could not be verified."],
      PAYMENT_PLAN_INVALID: [400, "The payment plan is no longer active."],
      PAYMENT_AMOUNT_MISMATCH: [400, "The amount paid does not match the configured payment total."],
      PAYMENT_ENROLLMENT_ROLE_INVALID: [400, "Enrollment-linked payments must come from a parent portal."],
      ENROLLMENT_NOT_FOUND: [404, "Linked enrollment request could not be found."],
      ENROLLMENT_OWNER_MISMATCH: [403, "Payment is not authorized for this enrollment request."],
      ENROLLMENT_PLAN_MISMATCH: [400, "Payment plan does not match the linked enrollment request."],
      ENROLLMENT_ALREADY_PAID: [409, "This enrollment request has already been paid."]
    };
    if (errors[code]) return json(errors[code][0], { error: errors[code][1] });
    console.error("Payment verification error:", error);
    return json(500, { error: "Unable to verify payment." });
  }
};
