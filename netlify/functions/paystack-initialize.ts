import type { Handler } from "@netlify/functions";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";

function firebase() {
  const app = getApps()[0] || initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n")
  })});
  return { auth: getAuth(app), db: getFirestore(app, process.env.FIREBASE_DATABASE_ID) };
}
const plans: Record<string, number> = {
  "Weekend STEM & Coding Track": 45000,
  "1-on-1 Intensive Mentorship": 120000,
  "Smart Robotics & IoT Hardware Lab": 85000,
  "Institutional STEM Lab Partner": 350000,
  "CBT Exam Portal & Lab Suite": 600000
};
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const authz = event.headers.authorization || "";
    if (!authz.startsWith("Bearer ")) return { statusCode: 401, body: JSON.stringify({error:"Authentication required"}) };
    const { auth, db } = firebase();
    const decoded = await auth.verifyIdToken(authz.slice(7));
    const body = JSON.parse(event.body || "{}");
    const plan = String(body.plan || "");
    const amount = plans[plan];
    if (!amount || !decoded.email) return { statusCode: 400, body: JSON.stringify({error:"Invalid payment plan"}) };
    const reference = `JBL-${Date.now()}-${randomUUID().replace(/-/g,"").slice(0,10)}`;
    const ref = db.collection("payments").doc();
    await ref.set({ userId: decoded.uid, email: decoded.email.toLowerCase(), plan, role: String(body.role || "student").toUpperCase(), amount, amountSubunit: amount*100, reference, status:"PENDING", paymentProvider:"PAYSTACK", createdAt:FieldValue.serverTimestamp() });
    const response = await fetch("https://api.paystack.co/transaction/initialize", { method:"POST", headers:{ Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type":"application/json" }, body:JSON.stringify({ email:decoded.email, amount:String(amount*100), currency:"NGN", reference, callback_url:`${(process.env.PUBLIC_APP_URL || "").replace(/\/$/,"")}/portal/${String(body.role || "student").toLowerCase()}/payments?payment=complete`, metadata:{userId:decoded.uid, plan, paymentDocumentId:ref.id} }) });
    const data:any = await response.json();
    if (!response.ok || !data?.status) { await ref.update({status:"INITIALIZATION_FAILED", providerMessage:data?.message || "Paystack initialization failed"}); return {statusCode:502,body:JSON.stringify({error:data?.message || "Unable to initialize payment"})}; }
    await ref.update({accessCode:data.data.access_code,authorizationUrl:data.data.authorization_url,initializedAt:FieldValue.serverTimestamp()});
    return {statusCode:200,headers:{"Content-Type":"application/json"},body:JSON.stringify({authorizationUrl:data.data.authorization_url,accessCode:data.data.access_code,reference})};
  } catch (e) { console.error(e); return {statusCode:500,body:JSON.stringify({error:"Unable to initialize payment securely"})}; }
};
