import { adminDb } from "./firebase-admin";

export const RESEND_CONFIG = {
  apiKey: process.env.RESEND_API_KEY || "",
  defaultFrom: process.env.EMAIL_FROM || "Jaystarbliss Studios <onboarding@resend.dev>",
  supportEmail: "jaystarblissstudios@gmail.com",
  brandName: "Jaystarbliss Studios",
  portalUrl: "https://jaystarbliss.com/portal",
  websiteUrl: "https://jaystarbliss.com"
};

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface PortalNotification {
  recipientId: string;
  email?: string | null;
  title: string;
  message: string;
  type?: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  actionText?: string;
}

/**
 * Generates an email HTML template styled for Jaystarbliss Studios.
 */
export function buildBrandedEmailHtml(options: {
  title: string;
  previewText?: string;
  greeting?: string;
  messageLines: string[];
  highlightBox?: {
    title?: string;
    items: Array<{ label: string; value: string }>;
  };
  cta?: {
    text: string;
    url: string;
  };
  footerNote?: string;
}): string {
  const { title, previewText, greeting, messageLines, highlightBox, cta, footerNote } = options;

  const messagesHtml = messageLines
    .map(line => `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">${line}</p>`)
    .join("");

  let highlightHtml = "";
  if (highlightBox && highlightBox.items.length > 0) {
    const itemsHtml = highlightBox.items
      .map(
        item => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #64748b; width: 40%;">${item.label}</td>
          <td style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${item.value}</td>
        </tr>`
      )
      .join("");

    highlightHtml = `
      <div style="margin: 24px 0; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
        ${highlightBox.title ? `<div style="background-color: #0f172a; color: #ffffff; padding: 10px 16px; font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">${highlightBox.title}</div>` : ""}
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>`;
  }

  let ctaHtml = "";
  if (cta && cta.url) {
    ctaHtml = `
      <div style="margin: 32px 0 24px 0; text-align: center;">
        <a href="${cta.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; font-weight: 800; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25);">
          ${cta.text} &rarr;
        </a>
      </div>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${previewText ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ""}
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 32px 28px 32px; text-align: left; border-bottom: 3px solid #e11d48;">
              <div style="font-size: 11px; font-weight: 900; letter-spacing: 0.15em; color: #fb7185; text-transform: uppercase; margin-bottom: 6px;">
                JAYSTARBLISS STUDIOS & ACADEMY
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.02em;">
                ${title}
              </h1>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              ${greeting ? `<p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #0f172a;">${greeting}</p>` : ""}
              
              ${messagesHtml}
              ${highlightHtml}
              ${ctaHtml}

              ${footerNote ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #64748b; line-height: 1.5;">${footerNote}</div>` : ""}
            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #475569;">
                Jaystarbliss Studios • Tech Education & Creative Innovation
              </p>
              <p style="margin: 0 0 12px 0; font-size: 11px; color: #94a3b8;">
                Lagos, Nigeria • Direct Phone / WhatsApp: +234 913 651 8194
              </p>
              <div style="margin: 8px 0;">
                <a href="${RESEND_CONFIG.websiteUrl}" style="color: #e11d48; text-decoration: none; font-size: 11px; font-weight: 700; margin: 0 8px;">Website</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="${RESEND_CONFIG.portalUrl}" style="color: #e11d48; text-decoration: none; font-size: 11px; font-weight: 700; margin: 0 8px;">Student & School Portal</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="mailto:${RESEND_CONFIG.supportEmail}" style="color: #e11d48; text-decoration: none; font-size: 11px; font-weight: 700; margin: 0 8px;">Support</a>
              </div>
              <p style="margin: 12px 0 0 0; font-size: 10px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Jaystarbliss Studios. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Sends an email via the Resend API.
 */
export async function sendResendEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = RESEND_CONFIG.apiKey;
  const from = options.from || RESEND_CONFIG.defaultFrom;
  const to = Array.isArray(options.to) ? options.to : [options.to];

  if (!apiKey) {
    console.warn("[Resend] Missing RESEND_API_KEY. Email skipped.");
    return { success: false, error: "Missing RESEND_API_KEY" };
  }

  if (!to || to.length === 0 || !to[0]) {
    return { success: false, error: "No recipient email provided" };
  }

  try {
    const payload: Record<string, unknown> = {
      from,
      to,
      subject: options.subject,
      text: options.text || (options.html ? options.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "")
    };

    if (options.html) payload.html = options.html;
    if (options.replyTo) payload.reply_to = options.replyTo;
    if (options.cc) payload.cc = Array.isArray(options.cc) ? options.cc : [options.cc];
    if (options.bcc) payload.bcc = Array.isArray(options.bcc) ? options.bcc : [options.bcc];

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn("[Resend] Email delivery failed:", data);
      return { success: false, error: data.message || "Resend API error" };
    }

    return { success: true, id: data.id };
  } catch (error: any) {
    console.error("[Resend] Network / API error:", error);
    return { success: false, error: error.message || "Failed to dispatch email" };
  }
}

/**
 * Creates an in-app portal notification and simultaneously dispatches an email via Resend if email is provided.
 */
export async function createPortalNotification(input: PortalNotification) {
  if (!input.recipientId) return;
  const now = new Date();
  
  try {
    await adminDb.collection("notifications").add({
      recipientId: input.recipientId,
      title: input.title,
      message: input.message,
      type: input.type || "SYSTEM",
      data: input.data || {},
      read: false,
      createdAt: now,
      timestamp: now
    });
  } catch (dbErr) {
    console.warn("[Notification DB] Failed to save in-app notification:", dbErr);
  }

  if (!input.email) return;

  const html = buildBrandedEmailHtml({
    title: input.title,
    previewText: input.message.slice(0, 100),
    greeting: "Hello,",
    messageLines: [input.message],
    cta: input.actionUrl
      ? {
          text: input.actionText || "Open Jaystarbliss Portal",
          url: input.actionUrl
        }
      : {
          text: "Open Student / Staff Portal",
          url: RESEND_CONFIG.portalUrl
        },
    footerNote: "This is an automated notification regarding your Jaystarbliss account and portal activities."
  });

  await sendResendEmail({
    to: input.email,
    subject: `[Jaystarbliss] ${input.title}`,
    html,
    text: input.message
  });
}

/**
 * Send auto-response confirmation to a client who submits an inquiry / contact form.
 */
export async function sendClientInquiryConfirmation(params: {
  clientName: string;
  clientEmail: string;
  subject: string;
  message: string;
  inquiryType?: string;
}) {
  const html = buildBrandedEmailHtml({
    title: "We Received Your Message",
    previewText: `Thank you for reaching out to Jaystarbliss Studios, ${params.clientName}.`,
    greeting: `Dear ${params.clientName || "Valued Client"},`,
    messageLines: [
      "Thank you for contacting Jaystarbliss Studios! We have received your inquiry and our academic & technical admissions team has been notified.",
      "A specialist will review your details and reach out to you within 24 hours to guide you through the next steps.",
      "Here is a summary of the details you submitted:"
    ],
    highlightBox: {
      title: "Inquiry Details",
      items: [
        { label: "Category", value: params.inquiryType || "General Inquiry" },
        { label: "Subject", value: params.subject || "Academic / Studio Inquiry" },
        { label: "Submission Date", value: new Date().toLocaleDateString("en-NG", { dateStyle: "long" }) },
        { label: "Status", value: "Received / Under Review" }
      ]
    },
    cta: {
      text: "Explore Our Learning Programs",
      url: `${RESEND_CONFIG.websiteUrl}/programs`
    },
    footerNote: "Need immediate assistance? You can chat with our admissions desk on WhatsApp at +234 913 651 8194."
  });

  return sendResendEmail({
    to: params.clientEmail,
    subject: `Thank you for reaching out to Jaystarbliss Studios [Ref: #${Date.now().toString().slice(-6)}]`,
    html,
    text: `Dear ${params.clientName},\n\nThank you for reaching out to Jaystarbliss Studios. We have received your message regarding "${params.subject}". Our team will review your request and get back to you within 24 hours.\n\nBest regards,\nJaystarbliss Studios Team`
  });
}

/**
 * Send an email notification to the studio admin when a client submits an inquiry or project request.
 */
export async function sendAdminInquiryAlert(params: {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  subject: string;
  message: string;
  inquiryType?: string;
}) {
  const adminEmail = RESEND_CONFIG.supportEmail;

  const html = buildBrandedEmailHtml({
    title: `New Client Lead: ${params.inquiryType || "Website Inquiry"}`,
    previewText: `New message from ${params.clientName} (${params.clientEmail})`,
    greeting: "Hello Jaystarbliss Admin Team,",
    messageLines: [
      `A new inquiry has been submitted on the Jaystarbliss website by <strong>${params.clientName}</strong>.`,
      `<em>"${params.message}"</em>`
    ],
    highlightBox: {
      title: "Contact Info & Lead Data",
      items: [
        { label: "Client Name", value: params.clientName || "—" },
        { label: "Client Email", value: params.clientEmail || "—" },
        { label: "Phone / WhatsApp", value: params.clientPhone || "Not provided" },
        { label: "Inquiry Type", value: params.inquiryType || "General" },
        { label: "Subject", value: params.subject || "—" }
      ]
    },
    cta: {
      text: "Open Admin Inquiries Dashboard",
      url: `${RESEND_CONFIG.portalUrl}/admin/inquiries`
    }
  });

  return sendResendEmail({
    to: adminEmail,
    subject: `🚨 [New Client Lead] ${params.clientName} - ${params.subject || params.inquiryType}`,
    html,
    replyTo: params.clientEmail
  });
}

/**
 * Send direct custom email to a client from the Admin Portal.
 */
export async function sendDirectClientEmail(params: {
  to: string;
  recipientName?: string;
  subject: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}) {
  const html = buildBrandedEmailHtml({
    title: params.subject,
    previewText: params.message.slice(0, 100),
    greeting: params.recipientName ? `Dear ${params.recipientName},` : "Hello,",
    messageLines: params.message.split("\n\n").filter(Boolean),
    cta: params.actionUrl
      ? {
          text: params.actionText || "View in Portal",
          url: params.actionUrl
        }
      : undefined,
    footerNote: "You are receiving this communication because you are a registered student, parent, school administrator, or client of Jaystarbliss Studios."
  });

  return sendResendEmail({
    to: params.to,
    subject: `[Jaystarbliss] ${params.subject}`,
    html,
    text: params.message
  });
}

