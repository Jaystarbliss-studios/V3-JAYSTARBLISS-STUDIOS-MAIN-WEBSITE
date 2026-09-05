import type { Config } from '@netlify/functions';
import { adminDb } from '../../api/_lib/firebase-admin';
import { createPortalNotification } from '../../api/_lib/email';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = [3, 1, 0];

export default async () => {
  const now = new Date();
  const payments = await adminDb.collection('payments').where('status', '==', 'PAID').limit(300).get();
  let processed = 0;

  for (const paymentDoc of payments.docs) {
    const payment = paymentDoc.data() || {};
    const recipientId = String(payment.userId || payment.parentId || payment.schoolId || '').trim();
    if (!recipientId) continue;
    const paidAtValue = payment.paidAt || payment.paymentDate || payment.createdAt;
    const paidAt = typeof paidAtValue?.toDate === 'function' ? paidAtValue.toDate() : new Date(paidAtValue || 0);
    if (Number.isNaN(paidAt.getTime())) continue;
    const cycleWeeks = Math.max(1, Number(payment.durationWeeks || 4));
    const due = new Date(paidAt.getTime() + cycleWeeks * 7 * MS_PER_DAY);
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / MS_PER_DAY);
    if (!REMINDER_DAYS.includes(daysUntilDue)) continue;
    const reminderKey = `${due.toISOString().slice(0, 10)}:${daysUntilDue}`;
    if (String(payment.dueReminderKey || '') === reminderKey) continue;

    const recipientSnap = await adminDb.collection('users').doc(recipientId).get();
    const recipient = recipientSnap.exists ? recipientSnap.data() || {} : {};
    const amount = Number(payment.customerTotal ?? payment.amountPaid ?? payment.amount ?? 0);
    const childLabel = String(payment.studentName || (String(payment.schoolId || '') ? 'your school account' : 'your student account'));
    const title = daysUntilDue === 0 ? 'Payment due today' : `Payment due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
    const message = `${payment.plan || payment.planName || 'Your learning plan'} for ${childLabel} is due ${due.toLocaleDateString('en-NG')}. The previous payment was ${paidAt.toLocaleDateString('en-NG')} for ₦${amount.toLocaleString()}.`;

    await createPortalNotification({
      recipientId,
      email: typeof recipient.email === 'string' ? recipient.email : undefined,
      title,
      message,
      type: 'PAYMENT_DUE_REMINDER',
      data: { paymentId: paymentDoc.id, dueAt: due.toISOString(), amount, daysUntilDue, reminderKey }
    });
    await paymentDoc.ref.update({ dueReminderKey: reminderKey, dueReminderSentAt: new Date(), dueReminderDaysBefore: daysUntilDue });
    processed += 1;
  }

  return new Response(JSON.stringify({ processed, checked: payments.size }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export const config: Config = { schedule: '0 8 * * *' };
