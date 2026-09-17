import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';
import { createPortalNotification } from '../../api/_lib/email';
import crypto from 'node:crypto';

const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const getBearer = (event: any) => { const value = event.headers?.authorization || event.headers?.Authorization || ''; return value.startsWith('Bearer ') ? value.slice(7) : ''; };
const clean = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max);
const roles = new Set(['ADMIN', 'SUPER_ADMIN', 'EDUCATION_ADMIN']);
const makeCode = (name: string) => `${name.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'SCHOOL'}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let createdUid = '';
  try {
    const bearer = getBearer(event); if (!bearer) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(bearer); const actorSnap = await adminDb.collection('users').doc(decoded.uid).get(); const actor = actorSnap.data() || {};
    if (!roles.has(String(actor.role || '').toUpperCase())) return json(403, { error: 'Only authorized education administrators can approve school partnerships.' });
    const body = JSON.parse(event.body || '{}'); const inquiryId = clean(body.inquiryId, 160); if (!inquiryId) return json(400, { error: 'inquiryId is required.' });
    const inquiryRef = adminDb.collection('inquiries').doc(inquiryId); const inquirySnap = await inquiryRef.get(); if (!inquirySnap.exists) return json(404, { error: 'School partnership inquiry not found.' }); const inquiry = inquirySnap.data() || {};
    if (String(inquiry.type || '').toUpperCase() !== 'SCHOOL_PARTNERSHIP_PROPOSAL') return json(400, { error: 'This inquiry is not a school partnership proposal.' }); if (String(inquiry.schoolId || '').trim()) return json(409, { error: 'This partnership inquiry has already been onboarded.' });
    const schoolName = clean(inquiry.schoolName || inquiry.name, 160); const contactName = clean(inquiry.name || inquiry.contactName, 120); const email = clean(inquiry.email, 160).toLowerCase(); const phone = clean(inquiry.phone, 40); const address = clean(inquiry.addressCity || inquiry.address, 300);
    if (!schoolName || !contactName || !email) return json(400, { error: 'The inquiry is missing school name, contact name, or email.' }); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'The partnership contact email is invalid.' });
    const duplicate = await adminDb.collection('schools').where('name', '==', schoolName).limit(1).get(); if (!duplicate.empty) return json(409, { error: 'A school with this name already exists. Review the existing school before approving this inquiry.' });
    const authUser = await adminAuth.createUser({ email, displayName: contactName, emailVerified: false }); createdUid = authUser.uid; const passwordSetupLink = await adminAuth.generatePasswordResetLink(email).catch(() => null); const schoolRef = adminDb.collection('schools').doc(); const code = makeCode(schoolName); const now = new Date();
    try {
      await adminDb.runTransaction(async transaction => {
        transaction.set(schoolRef, { name: schoolName, schoolCode: code, contactName, contactEmail: email, phone: phone || null, address: address || null, role: clean(inquiry.role, 100) || null, state: clean(inquiry.state, 80) || null, deliveryTier: clean(inquiry.deliveryTier, 80) || null, estimatedStudents: clean(inquiry.estimatedStudents, 80) || null, preferredDays: clean(inquiry.preferredDays, 120) || null, programsOfInterest: Array.isArray(inquiry.programsOfInterest) ? inquiry.programsOfInterest : [], partnershipMessage: clean(inquiry.message, 1500) || null, status: 'ACTIVE', onboardingStatus: 'APPROVED', sourceInquiryId: inquiryId, createdBy: decoded.uid, createdAt: now, updatedAt: now });
        transaction.set(adminDb.collection('users').doc(authUser.uid), { uid: authUser.uid, name: contactName, fullName: contactName, email, role: 'SCHOOL', schoolId: schoolRef.id, schoolCode: code, accountStatus: 'ACTIVE', forcePasswordReset: true, onboardingStatus: 'APPROVED', createdBy: decoded.uid, createdAt: now, updatedAt: now });
        transaction.set(adminDb.collection('schoolOnboarding').doc(schoolRef.id), { schoolId: schoolRef.id, schoolName, administratorId: authUser.uid, administratorEmail: email, sourceInquiryId: inquiryId, status: 'APPROVED', approvedBy: decoded.uid, createdBy: decoded.uid, createdAt: now, updatedAt: now });
        transaction.update(inquiryRef, { status: 'CONVERTED', schoolId: schoolRef.id, onboardingStatus: 'APPROVED', approvedBy: decoded.uid, approvedAt: now, updatedBy: decoded.uid, updatedAt: now });
        transaction.set(adminDb.collection('activityLogs').doc(), { type: 'school_partnership_approved', action: 'SCHOOL_PARTNERSHIP_APPROVED_AND_ONBOARDED', actorId: decoded.uid, inquiryId, schoolId: schoolRef.id, schoolName, userId: authUser.uid, userEmail: email, userType: 'SCHOOL', message: `School partnership ${schoolName} was approved and onboarded.`, timestamp: now, details: { schoolCode: code, deliveryTier: inquiry.deliveryTier || null, programsOfInterest: inquiry.programsOfInterest || [] } });
      });
    } catch (error) { await adminAuth.deleteUser(createdUid).catch(() => undefined); createdUid = ''; throw error; }
    const notificationMessage = `Your school partnership has been approved. School code: ${code}. Sign in to the Jaystarbliss School Portal using ${email}.${passwordSetupLink ? ` Complete your secure password setup here: ${passwordSetupLink}` : ' Contact the approving administrator for your secure password setup link.'}`;
    await createPortalNotification({ recipientId: authUser.uid, email, title: 'Your Jaystarbliss school portal is ready', message: notificationMessage, type: 'SCHOOL_ONBOARDING_APPROVED', data: { schoolId: schoolRef.id, schoolCode: code, setupLinkCreated: Boolean(passwordSetupLink) } }).catch(error => console.warn('School notification delivery failed:', error));
    return json(200, { success: true, school: { id: schoolRef.id, name: schoolName, schoolCode: code, status: 'ACTIVE' }, administrator: { uid: authUser.uid, name: contactName, email }, passwordSetupLink, notificationCreated: true });
  } catch (error: any) { console.error('School partnership approval error:', error); if (createdUid) await adminAuth.deleteUser(createdUid).catch(() => undefined); return json(500, { error: error?.message || 'Unable to approve this school partnership right now.' }); }
};
