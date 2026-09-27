import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';
import { 
  sendResendEmail, 
  buildBrandedEmailHtml, 
  sendClientInquiryConfirmation, 
  sendAdminInquiryAlert,
  sendDirectClientEmail,
  sendPasswordResetEmailResend,
  RESEND_CONFIG 
} from '../../api/_lib/email';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

const getBearer = (event: any) => {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
};

const clean = (val: unknown, max = 2000) => String(val ?? '').trim().slice(0, max);
const adminRoles = new Set(['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'EDUCATION_ADMIN']);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const action = clean(body.action || 'inquiry_confirmation', 60);

    // 1. PUBLIC ACTION: INQUIRY AUTO-RESPONDER & ADMIN ALERT
    if (action === 'inquiry_confirmation' || action === 'contact_form') {
      const clientName = clean(body.name || body.clientName, 120);
      const clientEmail = clean(body.email || body.clientEmail, 160).toLowerCase();
      const clientPhone = clean(body.phone || body.clientPhone, 40);
      const subject = clean(body.subject || body.inquirySubject || 'General Inquiry', 200);
      const message = clean(body.message, 2500);
      const inquiryType = clean(body.type || body.inquiryType || 'General Inquiry', 100);

      if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        return json(400, { error: 'A valid client email address is required.' });
      }

      // Send client auto-responder acknowledgement
      const clientResult = await sendClientInquiryConfirmation({
        clientName: clientName || 'Valued Client',
        clientEmail,
        subject,
        message,
        inquiryType
      });

      // Send admin team alert
      const adminResult = await sendAdminInquiryAlert({
        clientName: clientName || 'Anonymous Visitor',
        clientEmail,
        clientPhone: clientPhone || undefined,
        subject,
        message,
        inquiryType
      });

      return json(200, {
        success: true,
        clientEmailDelivered: clientResult.success,
        adminAlertDelivered: adminResult.success,
        clientId: clientResult.id || null
      });
    }

    // 2. PUBLIC / PORTAL ACTION: PASSWORD RESET VIA RESEND
    if (action === 'password_reset') {
      const email = clean(body.email || body.to || body.identifier, 160).toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(400, { error: 'A valid email address is required for password recovery.' });
      }

      let userRecord: any = null;
      try {
        userRecord = await adminAuth.getUserByEmail(email);
      } catch (err: any) {
        if (err?.code === 'auth/user-not-found') {
          return json(200, {
            success: true,
            message: 'If an account exists with this email address, a password reset link has been dispatched.'
          });
        }
      }

      let recipientName = userRecord?.displayName || clean(body.recipientName || body.name, 120);
      if (!recipientName && userRecord?.uid) {
        try {
          const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
          if (userDoc.exists) {
            const data = userDoc.data() || {};
            recipientName = data.name || data.fullName || data.contactName || '';
          }
        } catch {}
      }

      const actionCodeSettings = {
        url: `${RESEND_CONFIG.portalUrl}`,
        handleCodeInApp: false
      };

      const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
      const emailResult = await sendPasswordResetEmailResend({
        to: email,
        resetLink,
        recipientName: recipientName || undefined
      });

      if (!emailResult.success) {
        return json(502, { error: emailResult.error || 'Failed to deliver password reset email via Resend.' });
      }

      return json(200, {
        success: true,
        message: `Password reset link successfully sent to ${email} via Resend.`,
        id: emailResult.id
      });
    }

    // 3. AUTHENTICATED ADMIN ACTIONS (TEST EMAIL & DIRECT CLIENT EMAIL)
    const bearer = getBearer(event);
    if (!bearer) {
      return json(401, { error: 'Authentication required for administrative email operations.' });
    }

    const decoded = await adminAuth.verifyIdToken(bearer);
    const actorDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const actorRole = String(actorDoc.data()?.role || '').toUpperCase();

    if (!adminRoles.has(actorRole)) {
      return json(403, { error: 'Only administrative personnel can dispatch direct emails or tests.' });
    }

    // Action: Test Email Dispatch
    if (action === 'test_email') {
      const targetEmail = clean(body.to || decoded.email, 160).toLowerCase();
      if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        return json(400, { error: 'Please provide a valid recipient email address for testing.' });
      }

      const html = buildBrandedEmailHtml({
        title: 'Resend Email Service Test Successful',
        previewText: 'Your Jaystarbliss Studios Resend email integration is working perfectly.',
        greeting: `Hello ${actorDoc.data()?.name || decoded.email || 'Admin'},`,
        messageLines: [
          'Congratulations! Your Resend email integration with Jaystarbliss Studios has been verified and is fully operational.',
          'All future transactional emails, including admission confirmations, payment receipts, tuition reminders, and inquiry responses, will be automatically delivered through this high-deliverability channel.'
        ],
        highlightBox: {
          title: 'Resend Configuration Diagnostics',
          items: [
            { label: 'Sender Identity', value: RESEND_CONFIG.defaultFrom },
            { label: 'Test Recipient', value: targetEmail },
            { label: 'Timestamp', value: new Date().toLocaleString('en-NG') },
            { label: 'API Status', value: 'Active & Verified' }
          ]
        },
        cta: {
          text: 'Open Admin Management Portal',
          url: `${RESEND_CONFIG.portalUrl}/admin`
        },
        footerNote: 'This test was triggered by an authenticated administrator from the Jaystarbliss Admin Settings panel.'
      });

      const result = await sendResendEmail({
        to: targetEmail,
        subject: '✅ [Jaystarbliss] Resend Email Integration Verified',
        html,
        text: 'Your Jaystarbliss Studios Resend email integration is functioning properly.'
      });

      if (!result.success) {
        return json(502, { error: result.error || 'Failed to deliver test email via Resend.' });
      }

      return json(200, {
        success: true,
        message: `Test email successfully dispatched to ${targetEmail}. Check your inbox or spam folder!`,
        id: result.id
      });
    }

    // Action: Direct Email to Client / Parent / Tutor / School
    if (action === 'direct_email') {
      const to = clean(body.to, 160).toLowerCase();
      const recipientName = clean(body.recipientName || body.name, 120);
      const subject = clean(body.subject, 200);
      const message = clean(body.message, 5000);
      const actionUrl = clean(body.actionUrl, 300);
      const actionText = clean(body.actionText, 80);

      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return json(400, { error: 'A valid recipient email is required.' });
      }

      if (!subject || !message) {
        return json(400, { error: 'Subject and message body are required.' });
      }

      const result = await sendDirectClientEmail({
        to,
        recipientName: recipientName || undefined,
        subject,
        message,
        actionUrl: actionUrl || undefined,
        actionText: actionText || undefined
      });

      if (!result.success) {
        return json(502, { error: result.error || 'Failed to dispatch direct email.' });
      }

      // Log communication in activityLogs
      await adminDb.collection('activityLogs').add({
        type: 'email_dispatched',
        action: 'DIRECT_CLIENT_EMAIL',
        actorId: decoded.uid,
        actorEmail: decoded.email,
        recipientEmail: to,
        subject,
        timestamp: new Date(),
        resendMessageId: result.id || null
      });

      return json(200, {
        success: true,
        message: `Email successfully sent to ${to}`,
        id: result.id
      });
    }

    return json(400, { error: `Unsupported action: ${action}` });
  } catch (error: any) {
    console.error('send-client-email handler error:', error);
    return json(500, { error: error?.message || 'Internal server error while processing email request.' });
  }
};
