import type { Handler } from '@netlify/functions';
import { adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const clean = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max);

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const name = clean(body.name, 120); const schoolName = clean(body.schoolName, 160); const role = clean(body.role, 100); const email = clean(body.email, 160).toLowerCase(); const phone = clean(body.phone, 40); const addressCity = clean(body.addressCity, 160); const estimatedStudents = clean(body.estimatedStudents, 80); const preferredDays = clean(body.preferredDays, 120); const message = clean(body.message, 1500); const deliveryTier = clean(body.deliveryTier, 80); const programsOfInterest = Array.isArray(body.programsOfInterest) ? body.programsOfInterest.map((x: unknown) => clean(x, 180)).filter(Boolean).slice(0, 20) : [];
    if (!name || !schoolName || !role || !email || !deliveryTier || !programsOfInterest.length) return json(400, { error: 'Please complete all required partnership fields.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Please enter a valid email address.' });
    const now = new Date();
    const ref = await adminDb.collection('inquiries').add({ name, schoolName, role, email, phone: phone || null, addressCity: addressCity || null, estimatedStudents: estimatedStudents || null, preferredDays: preferredDays || null, programsOfInterest, message: message || null, deliveryTier, type: 'SCHOOL_PARTNERSHIP_PROPOSAL', status: 'NEW', source: 'PUBLIC_SCHOOL_PARTNERSHIP', createdAt: now, updatedAt: now });
    await adminDb.collection('activityLogs').add({ type: 'school_partnership_submitted', action: 'SCHOOL_PARTNERSHIP_SUBMITTED', inquiryId: ref.id, userEmail: email, userType: 'PUBLIC', message: `School partnership proposal received from ${schoolName}.`, timestamp: now, details: { schoolName, role, deliveryTier, estimatedStudents, programsOfInterest } });
    await adminDb.collection('notifications').add({ recipientRole: 'ADMIN', type: 'NEW_SCHOOL_PARTNERSHIP', title: 'New school partnership proposal', message: `${schoolName} submitted a school partnership proposal for review.`, inquiryId: ref.id, read: false, priority: 'HIGH', createdAt: now });
    return json(201, { success: true, inquiryId: ref.id });
  } catch (error) { console.error('School partnership submission error:', error); return json(500, { error: 'We could not submit the partnership request. Please try again.' }); }
};
