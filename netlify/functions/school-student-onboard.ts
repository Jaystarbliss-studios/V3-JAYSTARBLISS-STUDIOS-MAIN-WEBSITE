import type { Handler } from '@netlify/functions';
import { createHash, randomBytes } from 'node:crypto';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const bearer = (event: any) => {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
};

const clean = (value: unknown, max = 160) => String(value ?? '').trim().slice(0, max);
const normalizeCode = (value: string) => value.trim().toUpperCase();
const hashAccessCode = (value: string) => createHash('sha256').update(normalizeCode(value)).digest('hex');
const makeCode = () => `JBS-${randomBytes(5).toString('hex').toUpperCase()}`;
const makePassword = () => randomBytes(12).toString('base64url');

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let createdUid = '';
  try {
    const rawToken = bearer(event);
    if (!rawToken) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(rawToken);
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists) return json(403, { error: 'Portal profile not found.' });

    const caller = callerSnap.data() || {};
    const role = String(caller.role || '').trim().toUpperCase();
    if (role !== 'SCHOOL' || caller.status === 'SUSPENDED' || caller.accountStatus === 'SUSPENDED' || caller.accountStatus === 'BANNED') {
      return json(403, { error: 'Only an active school account can onboard students.' });
    }

    const schoolId = clean(caller.schoolId || '');
    if (!schoolId) return json(403, { error: 'This school account is not linked to a school.' });

    const schoolSnap = await adminDb.collection('schools').doc(schoolId).get();
    if (!schoolSnap.exists) return json(404, { error: 'School record not found.' });
    const school = schoolSnap.data() || {};
    if (['SUSPENDED', 'BANNED', 'DISABLED'].includes(String(school.accountStatus || school.status || 'ACTIVE').toUpperCase())) {
      return json(403, { error: 'This school account is currently disabled.' });
    }

    const body = JSON.parse(event.body || '{}');
    const fullName = clean(body.fullName);
    const username = clean(body.username, 80).toLowerCase().replace(/\s+/g, '');
    const email = clean(body.email, 160).toLowerCase();
    const className = clean(body.class || body.grade || '', 80);
    const track = clean(body.track || '', 120);
    const parentId = clean(body.parentId || '', 160);
    const requestedCode = clean(body.accessCode || body.passcode || '', 40);

    if (!fullName || !username || !className) {
      return json(400, { error: 'Student name, username and class are required.' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: 'Enter a valid student email or leave it blank.' });
    }

    const duplicate = await adminDb.collection('individualStudents').where('username', '==', username).limit(1).get();
    if (!duplicate.empty) return json(409, { error: 'That student username is already in use.' });

    const accessCode = normalizeCode(requestedCode || makeCode());
    const accessCodeHash = hashAccessCode(accessCode);
    const codeDuplicate = await adminDb.collection('individualStudents').where('accessCodeHash', '==', accessCodeHash).limit(1).get();
    if (!codeDuplicate.empty) return json(409, { error: 'That student access code is already in use.' });
    const legacyCodeDuplicate = await adminDb.collection('individualStudents').where('accessCode', '==', accessCode).limit(1).get();
    if (!legacyCodeDuplicate.empty) return json(409, { error: 'That student access code is already in use.' });

    const syntheticEmail = `student-${randomBytes(10).toString('hex')}@jbs-portal.local`;
    const authUser = await adminAuth.createUser({ email: email || syntheticEmail, password: makePassword(), displayName: fullName, disabled: false });
    createdUid = authUser.uid;

    const studentRef = adminDb.collection('individualStudents').doc();
    const now = new Date();
    await studentRef.set({
      fullName,
      studentName: fullName,
      username,
      accessCodeHash,
      schoolId,
      schoolName: school.name || school.schoolName || '',
      class: className,
      grade: className,
      track,
      email: email || null,
      parentId: parentId || null,
      firebaseUid: authUser.uid,
      userId: authUser.uid,
      portalAccessEnabled: true,
      accountStatus: 'ACTIVE',
      source: 'school_onboarding',
      createdAt: now,
      updatedAt: now,
    });

    await adminDb.collection('users').doc(authUser.uid).set({
      email: authUser.email || null,
      name: fullName,
      role: 'student',
      studentDocId: studentRef.id,
      schoolId,
      schoolName: school.name || school.schoolName || '',
      portalAccessEnabled: true,
      accountStatus: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    await adminDb.collection('activityLogs').add({ actorId: decoded.uid, action: 'SCHOOL_STUDENT_ONBOARDED', targetId: studentRef.id, targetType: 'student', schoolId, timestamp: now, metadata: { username, class: className } });

    return json(201, {
      student: { id: studentRef.id, fullName, username, class: className, schoolId, portal: '/portal/student' },
      credentials: { username, accessCode, portal: '/portal/student' },
    });
  } catch (error) {
    if (createdUid) {
      try { await adminAuth.deleteUser(createdUid); } catch (rollbackError) { console.error('Student Auth rollback failed:', rollbackError); }
    }
    console.error('School student onboarding error:', error);
    return json(500, { error: 'Unable to onboard the student. No partial account should remain.' });
  }
};
