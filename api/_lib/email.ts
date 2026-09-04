import { adminDb } from "./firebase-admin";

interface PortalNotification {
  recipientId: string;
  email?: string | null;
  title: string;
  message: string;
  type?: string;
  data?: Record<string, unknown>;
}

export async function createPortalNotification(input: PortalNotification) {
  if (!input.recipientId) return;
  await adminDb.collection("notifications").add({
    recipientId: input.recipientId,
    title: input.title,
    message: input.message,
    type: input.type || "SYSTEM",
    data: input.data || {},
    read: false,
    createdAt: new Date()
  });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !input.email) return;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: input.title,
        text: input.message
      })
    });
    if (!response.ok) {
      console.warn("Portal email delivery failed:", await response.text());
    }
  } catch (error) {
    console.warn("Portal email delivery error:", error);
  }
}
