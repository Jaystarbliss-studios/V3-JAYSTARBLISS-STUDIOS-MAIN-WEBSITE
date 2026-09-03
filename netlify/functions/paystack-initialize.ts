import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const plans: Record<string, { name: string; amount: number; role: "student" | "school" }> = {
  plan_weekend: { name: "Weekend STEM & Coding Track", amount: 45000, role: "student" },
  plan_mentorship: { name: "1-on-1 Intensive Mentorship", amount: 120000, role: "student" },
  plan_robotics: { name: "Smart Robotics & IoT Hardware Lab", amount: 85000, role: "student" },
  school_standard: { name: "Institutional STEM Lab Partner", amount: 350000, role: "school" },
  school_cbt: { name: "CBT Exam Portal & Lab Suite", amount: 600000, role: "school" }
};

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
    const body = JSON.parse(event.body || "{}");
    const plan = plans[String(body.planId || "")];
    if (!plan) return { statusCode: 400, body: JSON.stringify({ error: "Invalid payment plan." }) };

    const callback = process.env.PUBLIC_APP_URL;
    if (!callback) return { statusCode: 500, body: JSON.stringify({ error: "Payment callback is not configured." }) };

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: decoded.email,
        amount: plan.amount * 100,
        currency: "NGN",
        callback_url: `${callback.replace(/\/$/, "")}/portal/payments`,
        channels: ["card", "bank_transfer"],
        metadata: {
          userId: decoded.uid,
          role: plan.role,
          planId: Object.keys(plans).find(key => plans[key] === plan),
          planName: plan.name
        }
      })
    });

    const data = await response.json();
    if (!response.ok || !data.status || !data.data?.authorization_url) {
      console.error("Paystack initialization failed:", data);
      return { statusCode: 502, body: JSON.stringify({ error: "Unable to initialize payment." }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorizationUrl: data.data.authorization_url, reference: data.data.reference })
    };
  } catch (error) {
    console.error("Payment initialization error:", error);
    return { statusCode: 401, body: JSON.stringify({ error: "Unable to authenticate payment request." }) };
  }
};
