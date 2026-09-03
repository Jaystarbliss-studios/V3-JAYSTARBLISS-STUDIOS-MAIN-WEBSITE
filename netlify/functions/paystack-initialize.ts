import type { Handler } from "@netlify/functions";
import { adminAuth } from "../../api/_lib/firebase-admin";

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

const getCallbackPath = (role: string, planRole: "student" | "school") => {
  if (planRole === "school") return "/portal/school/payments";
  if (role === "parent") return "/portal/parent/payments";
  return "/portal/student/payments";
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const token = getToken(event);
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Authentication required." }) };

    const decoded = await adminAuth.verifyIdToken(token);
    const body = JSON.parse(event.body || "{}");
    const planId = String(body.planId || "");
    const plan = plans[planId];
    if (!plan) return { statusCode: 400, body: JSON.stringify({ error: "Invalid payment plan." }) };

    const requestedRole = String(body.role || "student").toLowerCase();
    const allowedRoles = plan.role === "school" ? ["school"] : ["student", "parent"];
    if (!allowedRoles.includes(requestedRole)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Payment plan is not available for this portal role." }) };
    }

    const requestedMethod = String(body.paymentMethod || "card").toLowerCase();
    if (requestedMethod !== "card" && requestedMethod !== "bank_transfer") {
      return { statusCode: 400, body: JSON.stringify({ error: "Unsupported payment method." }) };
    }

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
        callback_url: `${callback.replace(/\/$/, "")}${getCallbackPath(requestedRole, plan.role)}`,
        channels: [requestedMethod],
        metadata: {
          userId: decoded.uid,
          role: requestedRole,
          planRole: plan.role,
          planId,
          planName: plan.name,
          paymentMethod: requestedMethod
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
