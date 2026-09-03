import type { Handler } from "@netlify/functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../../api/_lib/firebase-admin";

const allowedTypes = new Set(["CONTACT", "SCHOOL_PARTNERSHIP_PROPOSAL"]);

const clean = (value: unknown, max: number) =>
  String(value ?? "").trim().slice(0, max);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const type = clean(body.type, 40).toUpperCase();
    const name = clean(body.name, 120);
    const email = clean(body.email, 160).toLowerCase();
    const message = clean(body.message, 4000);

    if (!allowedTypes.has(type)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid inquiry type." }) };
    }
    if (name.length < 2 || !emailPattern.test(email) || message.length < 5) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please provide a valid name, email and message." }) };
    }

    if (type === "SCHOOL_PARTNERSHIP_PROPOSAL") {
      const schoolName = clean(body.schoolName, 180);
      const role = clean(body.role, 120);
      const programsOfInterest = Array.isArray(body.programsOfInterest)
        ? body.programsOfInterest.map((v: unknown) => clean(v, 180)).filter(Boolean).slice(0, 12)
        : [];

      if (!schoolName || !role || programsOfInterest.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "Please complete the school and curriculum details." }) };
      }
    }

    // Lightweight abuse control. The public form cannot write directly to Firestore.
    const since = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
    const recent = await adminDb.collection("inquiries")
      .where("email", "==", email)
      .limit(4)
      .get();

    const recentCount = recent.docs.filter(doc => {
      const createdAt = doc.data().createdAt;
      const millis = typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : 0;
      return millis >= since.toMillis();
    }).length;

    if (recentCount >= 3) {
      return { statusCode: 429, body: JSON.stringify({ error: "Too many submissions from this email. Please try again later." }) };
    }

    const payload: Record<string, unknown> = {
      name,
      email,
      message,
      type,
      status: type === "CONTACT" ? "NEW" : "PENDING",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    if (type === "CONTACT") {
      payload.inquirySubject = clean(body.inquirySubject, 100) || "General Inquiry";
    } else {
      payload.schoolName = clean(body.schoolName, 180);
      payload.role = clean(body.role, 120);
      payload.phone = clean(body.phone, 40);
      payload.addressCity = clean(body.addressCity, 120);
      payload.estimatedStudents = clean(body.estimatedStudents, 60);
      payload.preferredDays = clean(body.preferredDays, 120);
      payload.programsOfInterest = Array.isArray(body.programsOfInterest)
        ? body.programsOfInterest.map((v: unknown) => clean(v, 180)).filter(Boolean).slice(0, 12)
        : [];
      payload.deliveryTier = clean(body.deliveryTier, 80);
    }

    const ref = await adminDb.collection("inquiries").add(payload);

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ submitted: true, inquiryId: ref.id })
    };
  } catch (error) {
    console.error("Inquiry submission error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to submit your inquiry right now." }) };
  }
};
