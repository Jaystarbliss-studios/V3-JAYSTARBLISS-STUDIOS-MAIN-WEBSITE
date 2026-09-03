import type { Handler } from "@netlify/functions";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
function firebase() { const app=getApps()[0] || initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID!,clientEmail:process.env.FIREBASE_CLIENT_EMAIL!,privateKey:process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g,"\n")})}); return {auth:getAuth(app),db:getFirestore(app,process.env.FIREBASE_DATABASE_ID)}; }
export const handler: Handler = async (event) => {
  if(event.httpMethod!=="POST") return {statusCode:405,body:"Method Not Allowed"};
  try {
    const h=event.headers.authorization||""; if(!h.startsWith("Bearer ")) return {statusCode:401,body:JSON.stringify({error:"Authentication required"})};
    const {auth,db}=firebase(); const decoded=await auth.verifyIdToken(h.slice(7)); const {reference}=JSON.parse(event.body||"{}");
    const snap=await db.collection("payments").where("reference","==",String(reference||"")).where("userId","==",decoded.uid).limit(1).get();
    if(snap.empty) return {statusCode:404,body:JSON.stringify({error:"Payment record not found"})};
    const doc=snap.docs[0], payment=doc.data(); if(payment.status==="VERIFIED") return {statusCode:200,body:JSON.stringify({verified:true,status:"VERIFIED",reference})};
    const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`}});
    const data:any=await response.json(), tx=data?.data;
    const verified=Boolean(response.ok&&data?.status&&tx?.status==="success"&&tx?.reference===reference&&Number(tx?.amount)===Number(payment.amountSubunit)&&String(tx?.currency||"NGN").toUpperCase()==="NGN");
    if(!verified){await doc.ref.update({status:"VERIFICATION_FAILED",providerMessage:data?.message||tx?.gateway_response||"Payment could not be verified",updatedAt:FieldValue.serverTimestamp()});return {statusCode:402,body:JSON.stringify({verified:false,error:"Payment could not be verified"})};}
    await doc.ref.update({status:"VERIFIED",providerStatus:tx.status,paymentMethod:tx.channel||null,providerTransactionId:tx.id||null,paidAt:tx.paid_at||null,verifiedAt:FieldValue.serverTimestamp()});
    return {statusCode:200,body:JSON.stringify({verified:true,status:"VERIFIED",reference,amount:payment.amount,paymentMethod:tx.channel||null})};
  } catch(e){console.error(e);return {statusCode:500,body:JSON.stringify({error:"Unable to verify payment securely"})};}
};
