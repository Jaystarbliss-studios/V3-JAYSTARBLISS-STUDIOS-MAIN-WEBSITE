import type { Handler } from "@netlify/functions";
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminDb } from "../../api/_lib/firebase-admin";

const plans: Record<string, { name: string; amount: number; roles: string[] }> = {
  plan_weekend: { name: "Weekend STEM & Coding Track", amount: 45000, roles: ["student", "parent"] },
  plan_mentorship: { name: "1-on-1 Intensive Mentorship", amount: 120000, roles: ["student", "parent"] },
  plan_robotics: { name: "Smart Robotics & IoT Hardware Lab", amount: 85000, roles: ["student", "parent"] },
  school_standard: { name: "Institutional STEM Lab Partner", amount: 350000, roles: ["school"] },
  school_cbt: { name: "CBT Exam Portal & Lab Suite", amount: 600000, roles: ["school"] }
};

const getHeader = (event: any, name: string) => event.headers?.[name] || event.headers?.[name.toLowerCase()] || event.headers?.[name.toUpperCase()] || "";

const isValidSignature = (rawBody: string, signature: string, secret: string) => {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const secret = process.env.PAYSTACK_SECRET_KEY || "";
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
  const signature = getHeader(event, "x-paystack-signature");

  if (!secret || !isValidSignature(rawBody, signature, secret)) {
    console.warn("Rejected Paystack webhook with invalid signature.");
    return { statusCode: 401, body: "Invalid signature" };
  }

  try {
    const payload = JSON.parse(rawBody || "{}");
    if (payload.event !== "charge.success") {
      return { statusCode: 200, body: "Event acknowledged" };
    }

    const tx = payload.data || {};
    const reference = String(tx.reference || "").trim();
    const metadata = tx.metadata || {};
    const userId = String(metadata.userId || "").trim();
    const role = String(metadata.role || "").toLowerCase().trim();
    const planId = String(metadata.planId || "").trim();
    const enrollmentRequestId = String(metadata.enrollmentRequestId || "").trim();
    const expectedPlan = plans[planId];

    if (!reference || !userId || !expectedPlan || !expectedPlan.roles.includes(role) || String(tx.status || "").toLowerCase() !== "success" || String(tx.currency || "").toUpperCase() !== "NGN" || Number(tx.amount) !== expectedPlan.amount * 100) {
      console.error("Ignored Paystack webhook: transaction integrity check failed.", {
        reference,
        userId,
        role,
        planId,
        currency: tx.currency,
        amount: tx.amount
      });
      return { statusCode: 200, body: "Event acknowledged" };
    }

    if (enrollmentRequestId && role !== "parent") {
      console.error("Ignored Paystack webhook: enrollment linkage requires parent role.", { reference, enrollmentRequestId, role });
      return { statusCode: 200, body: "Event acknowledged" };
    }

    const canonicalPaymentRef = adminDb.collection("payments").doc(reference);
    const legacyExisting = (await adminDb.collection("payments").where("reference", "==", reference).limit(1).get()).docs[0] || null;
    if (legacyExisting) {
      return { statusCode: 200, body: "Event already reconciled" };
    }

    const paymentData = {
      userId,
      parentId: role === "parent" ? userId : null,
      schoolId: role === "school" ? userId : null,
      email: String(tx.customer?.email || ""),
      plan: String(metadata.planName || expectedPlan.name),
      planId,
      amount: Number(tx.amount),
      currency: String(tx.currency || "NGN"),
      paymentMethod: String(tx.channel || "paystack"),
      status: "PAID",
      reference,
      role,
      enrollmentRequestId: enrollmentRequestId || null,
      enrollmentStudentName: metadata.enrollmentStudentName ? String(metadata.enrollmentStudentName) : null,
      description: `Tuition & Fee Renewal: ${metadata.planName || expectedPlan.name}`,
      createdAt: new Date(),
      paidAt: tx.paid_at ? new Date(tx.paid_at) : new Date()
    };

    const result = await adminDb.runTransaction(async (transaction) => {
      const paymentSnapshot = await transaction.get(canonicalPaymentRef);
      if (paymentSnapshot.exists) return "existing" as const;

      if (enrollmentRequestId) {
        const enrollmentRef = adminDb.collection("enrollment_requests").doc(enrollmentRequestId);
        const enrollmentSnapshot = await transaction.get(enrollmentRef);
        if (!enrollmentSnapshot.exists) throw new Error("ENROLLMENT_NOT_FOUND");

        const enrollmentData = enrollmentSnapshot.data() || {};
        if (String(enrollmentData.parentId || "") !== userId) throw new Error("ENROLLMENT_OWNER_MISMATCH");
        if (String(enrollmentData.planId || "") && String(enrollmentData.planId) !== planId) throw new Error("ENROLLMENT_PLAN_MISMATCH");
        if (String(enrollmentData.paymentStatus || "").toUpperCase() === "PAID") return "existing" as const;

        transaction.create(canonicalPaymentRef, paymentData);
        transaction.set(enrollmentRef, {
          paymentStatus: "PAID",
          paymentReference: reference,
          paymentPlanId: planId,
          paidAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
        return "created" as const;
      }

      transaction.create(canonicalPaymentRef, paymentData);
      return "created" as const;
    });

    return { statusCode: 200, body: result === "existing" ? "Event already reconciled" : "Webhook reconciled" };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ENROLLMENT_NOT_FOUND" || code === "ENROLLMENT_OWNER_MISMATCH" || code === "ENROLLMENT_PLAN_MISMATCH") {
      console.error("Paystack webhook enrollment reconciliation rejected:", error);
      return { statusCode: 200, body: "Event acknowledged" };
    }
    console.error("Paystack webhook processing error:", error);
    return { statusCode: 500, body: "Webhook processing failed" };
  }
};
