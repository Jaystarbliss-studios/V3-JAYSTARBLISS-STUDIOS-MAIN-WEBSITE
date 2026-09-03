import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const body = JSON.parse(event.body || "{}");
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const registrationCode = String(body.registrationCode || "").trim();

    if (!name || !email || password.length < 6 || !registrationCode || !email.includes("@")) {
      return { statusCode: 400, body: JSON.stringify({ error: "Complete staff registration details are required." }) };
    }

    const codeSnap = await adminDb.collection("staffRegistration").doc("code").get();
    const expectedCode = String(codeSnap.data()?.code || "").trim();
    if (!expectedCode || registrationCode !== expectedCode) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid staff registration code." }) };
    }

    const existing = await adminDb.collection("users").where("email", "==", email).limit(1).get();
    if (!existing.empty) {
      return { statusCode: 409, body: JSON.stringify({ error: "This email is already registered." }) };
    }

    const user = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
      disabled: false
    });

    await adminDb.collection("users").doc(user.uid).set({
      email,
      name,
      role: "staff",
      accountStatus: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await adminDb.collection("tutors").doc(user.uid).set({
      email,
      name,
      role: "staff",
      status: "ACTIVE",
      createdAt: new Date()
    }, { merge: true });

    const customToken = await adminAuth.createCustomToken(user.uid, { role: "staff" });
    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customToken, uid: user.uid })
    };
  } catch (error: any) {
    if (error?.code === "auth/email-already-exists") {
      return { statusCode: 409, body: JSON.stringify({ error: "This email is already registered." }) };
    }
    console.error("Staff registration error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to complete staff registration." }) };
  }
};
