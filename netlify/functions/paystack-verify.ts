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
    const metadataRole = String(tx.metadata?.role || "").toLowerCase();
    const metadataPlanId = String(tx.metadata?.planId || "");
    const enrollmentRequestId = String(tx.metadata?.enrollmentRequestId || "").trim();
    const expectedAmounts: Record<string, { amount: number; roles: Array<"student" | "parent" | "school"> }> = {
      plan_weekend: { amount: 45000, roles: ["student", "parent"] },
      plan_mentorship: { amount: 120000, roles: ["student", "parent"] },
      plan_robotics: { amount: 85000, roles: ["student", "parent"] },
      school_standard: { amount: 350000, roles: ["school"] },
      school_cbt: { amount: 600000, roles: ["school"] }
    };
    const expected = expectedAmounts[metadataPlanId];

    if (metadataUserId !== decoded.uid) {
      return { statusCode: 403, body: JSON.stringify({ error: "Payment ownership could not be verified." }) };
    }
    if (!expected || !expected.roles.includes(metadataRole as "student" | "parent" | "school") || String(tx.currency || "").toUpperCase() !== "NGN" || Number(tx.amount) !== expected.amount * 100) {
      console.error("Paystack transaction integrity check failed:", {
        reference,
        planId: metadataPlanId,
        role: metadataRole,
        currency: tx.currency,
        amount: tx.amount
      });
      return { statusCode: 400, body: JSON.stringify({ error: "Payment details could not be verified." }) };
    }

    const canonicalPaymentRef = adminDb.collection("payments").doc(reference);
    const canonicalExisting = await canonicalPaymentRef.get();
    const legacyExisting = canonicalExisting.exists
      ? null
      : (await adminDb.collection("payments").where("reference", "==", reference).limit(1).get()).docs[0] || null;
    if (legacyExisting) {
      const existingPayment = legacyExisting.data();
      if (
        String(existingPayment.userId || "") !== decoded.uid ||
        String(existingPayment.planId || "") !== metadataPlanId ||
        String(existingPayment.enrollmentRequestId || "") !== enrollmentRequestId
      ) {
        return { statusCode: 409, body: JSON.stringify({ error: "This payment reference is already associated with a different payment." }) };
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true, reference, enrollmentRequestId: enrollmentRequestId || null, alreadyRecorded: true })
      };
    }

    const paymentData = {
      userId: decoded.uid,
      parentId: metadataRole === "parent" ? decoded.uid : null,
      schoolId: metadataRole === "school" ? decoded.uid : null,
      email: decoded.email || tx.customer?.email || "",
      plan: tx.metadata?.planName || "Portal Renewal",
      planId: metadataPlanId,
      amount: tx.amount,
      currency: tx.currency || "NGN",
      paymentMethod: tx.channel || "paystack",
      status: "PAID",
      reference,
      role: metadataRole,
      enrollmentRequestId: enrollmentRequestId || null,
      enrollmentStudentName: tx.metadata?.enrollmentStudentName || null,
      description: `Tuition & Fee Renewal: ${tx.metadata?.planName || "Portal Renewal"}`,
      createdAt: new Date(),
      paidAt: tx.paid_at || null
    };

    const result = await adminDb.runTransaction(async (transaction) => {
      const paymentSnapshot = await transaction.get(canonicalPaymentRef);
      if (paymentSnapshot.exists) return "existing" as const;

      let enrollmentRequest: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;
      if (enrollmentRequestId) {
        if (metadataRole !== "parent") {
          throw new Error("ENROLLMENT_ROLE_MISMATCH");
        }
        const enrollmentRef = adminDb.collection("enrollment_requests").doc(enrollmentRequestId);
        enrollmentRequest = await transaction.get(enrollmentRef);
        if (!enrollmentRequest.exists) throw new Error("ENROLLMENT_NOT_FOUND");

        const enrollmentData = enrollmentRequest.data() || {};
        if (String(enrollmentData.parentId || "") !== decoded.uid) throw new Error("ENROLLMENT_OWNER_MISMATCH");
        if (String(enrollmentData.planId || "") && String(enrollmentData.planId) !== metadataPlanId) throw new Error("ENROLLMENT_PLAN_MISMATCH");
        if (String(enrollmentData.paymentStatus || "").toUpperCase() === "PAID") throw new Error("ENROLLMENT_ALREADY_PAID");

        transaction.create(canonicalPaymentRef, paymentData);
        transaction.set(enrollmentRef, {
          paymentStatus: "PAID",
          paymentReference: reference,
          paymentPlanId: metadataPlanId,
          paidAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
        return "created" as const;
      }

      transaction.create(canonicalPaymentRef, paymentData);
      return "created" as const;
    });

    if (result === "existing") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true, reference, enrollmentRequestId: enrollmentRequestId || null, alreadyRecorded: true })
      };
    }

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verified: true, reference, enrollmentRequestId: enrollmentRequestId || null }) };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ENROLLMENT_NOT_FOUND") return { statusCode: 404, body: JSON.stringify({ error: "Linked enrollment request could not be found." }) };
    if (code === "ENROLLMENT_OWNER_MISMATCH") return { statusCode: 403, body: JSON.stringify({ error: "Payment is not authorized for this enrollment request." }) };
    if (code === "ENROLLMENT_PLAN_MISMATCH") return { statusCode: 400, body: JSON.stringify({ error: "Payment plan does not match the linked enrollment request." }) };
    if (code === "ENROLLMENT_ALREADY_PAID") return { statusCode: 409, body: JSON.stringify({ error: "This enrollment request has already been paid." }) };
    if (code === "ENROLLMENT_ROLE_MISMATCH") return { statusCode: 400, body: JSON.stringify({ error: "Only parent enrollment payments can be linked to an enrollment request." }) };
    console.error("Payment verification error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to verify payment." }) };
  }
};
