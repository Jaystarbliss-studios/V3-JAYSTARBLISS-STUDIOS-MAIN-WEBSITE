import type { Handler } from '@netlify/functions';
import { createHash, randomBytes } from 'node:crypto';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const bearer = (event: any) => { const value = event.headers?.authorization || event.headers?.Authorization || ''; return value.startsWith('Bearer ') ? value.slice(7) : ''; };
const clean = (value: unknown, max = 160) => String(value ?? '').trim().slice(0, max);
const blocked = (value: unknown) => ['SUSPENDED', 'BANNED', 'DISABLED'].includes(String(value || 'ACTIVE').toUpperCase());
const hashCode = (value: string) => createHash('sha256').update(value.trim().toUpperCase()).digest('hex');
const makeCode = () => `JBS-${randomBytes(5).toString('hex').toUpperCase()}`;
const makePassword = () => randomBytes(12).toString('base64url');

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let createdUid = '';
  try {
    const token = bearer(event);
    if (!token) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(token);
    const adminSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!adminSnap.exists) return json(403, { error: 'Admin profile not found.' });
    const admin = adminSnap.data() || {};
    const role = String(admin.role || '').trim().toLowerCase();
    const allowed = ['admin', 'super_admin', 'content_admin', 'education_admin', 'services_admin', 'marketing_admin', 'support_admin'];
    if (!allowed.includes(role) || blocked(admin.accountStatus || admin.status)) return json(403, { error: 'Only an active administrator can provision students.' });

    let body: any = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid request payload.' }); }
    const fullName = clean(body.fullName);
    const username = clean(body.username, 80).toLowerCase().replace(/\s+/g, '');
    const email = clean(body.email, 160).toLowerCase();
    const className = clean(body.class || body.grade || '', 80);
    const track = clean(body.track || '', 120);
    const subjects = Array.isArray(body.subjects) ? body.subjects.map((subject: unknown) => clean(subject, 80)).filter(Boolean).slice(0, 12) : [];
    const schoolId = clean(body.schoolId || '', 160);
    const parentId = clean(body.parentId || '', 160);
    const requestedCode = clean(body.accessCode || body.passcode || '', 40);

    if (!fullName || !username) return json(400, { error: 'Student name and username are required.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Enter a valid student email or leave it blank.' });
    if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) return json(400, { error: 'Username must be 3–80 characters and use letters, numbers, dots, underscores, or hyphens.' });

    const duplicate = await adminDb.collection('individualStudents').where('username', '==', username).limit(1).get();
    if (!duplicate.empty) return json(409, { error: 'That student username is already in use.' });
    const accessCode = String(requestedCode || makeCode()).trim().toUpperCase();
    if (accessCode.length < 8 || accessCode.length > 40) return json(400, { error: 'Student access code must be between 8 and 40 characters.' });
    const accessCodeHash = hashCode(accessCode);
    const codeDuplicate = await adminDb.collection('individualStudents').where('accessCodeHash', '==', accessCodeHash).limit(1).get();
    if (!codeDuplicate.empty) return json(409, { error: 'That student access code is already in use.' });

    if (schoolId) {
      const schoolSnap = await adminDb.collection('schools').doc(schoolId).get();
      if (!schoolSnap.exists || blocked(schoolSnap.data()?.accountStatus || schoolSnap.data()?.status)) return json(400, { error: 'The selected school is not active.' });
    }
    if (parentId) {
      const parentSnap = await adminDb.collection('users').doc(parentId).get();
      if (!parentSnap.exists || String(parentSnap.data()?.role || '').toLowerCase() !== 'parent' || blocked(parentSnap.data()?.accountStatus || parentSnap.data()?.status)) return json(400, { error: 'The supplied parent account is not a valid active parent profile.' });
    }

    const syntheticEmail = `student-${randomBytes(10).toString('hex')}@jbs-portal.local`;
    const authUser = await adminAuth.createUser({ email: email || syntheticEmail, password: makePassword(), displayName: fullName, disabled: false });
    createdUid = authUser.uid;
    const studentRef = adminDb.collection('individualStudents').doc();
    const now = new Date();
    const schoolName = schoolId ? ((await adminDb.collection('schools').doc(schoolId).get()).data()?.name || (await adminDb.collection('schools').doc(schoolId).get()).data()?.schoolName || '') : '';
    await studentRef.set({ fullName, studentName: fullName, username, email: email || null, accessCodeHash, subjects, class: className || null, grade: className || null, track, schoolId: schoolId || null, schoolName, parentId: parentId || null, firebaseUid: authUser.uid, userId: authUser.uid, portalAccessEnabled: true, accountStatus: 'ACTIVE', source: 'admin_onboarding', createdAt: now, updatedAt: now });
    await adminDb.collection('users').doc(authUser.uid).set({ email: authUser.email || null, name: fullName, role: 'student', studentDocId: studentRef.id, schoolId: schoolId || null, schoolName, parentId: parentId || null, portalAccessEnabled: true, accountStatus: 'ACTIVE', createdAt: now, updatedAt: now });
    await adminDb.collection('activityLogs').add({ actorId: decoded.uid, action: 'ADMIN_STUDENT_ONBOARDED', targetId: studentRef.id, targetType: 'student', schoolId: schoolId || null, timestamp: now, metadata: { username, class: className || null, parentId: parentId || null } });
    return json(201, { student: { id: studentRef.id, fullName, username, class: className || null, schoolId: schoolId || null, portal: '/portal' }, credentials: { username, accessCode, portal: '/portal' } });
  } catch (error) {
    if (createdUid) { try { await adminAuth.deleteUser(createdUid); } catch (rollbackError) { console.error('Admin student Auth rollback failed:', rollbackError); } }
    console.error('Admin student onboarding error:', error);
    return json(500, { error: 'Unable to provision the student. No partial account should remain.' });
  }
};
