import type { Handler } from '@netlify/functions';
import { createHash, randomBytes } from 'node:crypto';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const bearer = (event: any) => { const value = event.headers?.authorization || event.headers?.Authorization || ''; return value.startsWith('Bearer ') ? value.slice(7) : ''; };
const blocked = (value: unknown) => ['SUSPENDED', 'BANNED', 'DISABLED'].includes(String(value || 'ACTIVE').toUpperCase());
const hashCode = (value: string) => createHash('sha256').update(value.trim().toUpperCase()).digest('hex');
const makeCode = () => `JBS-${randomBytes(5).toString('hex').toUpperCase()}`;
const roleOf = (value: unknown) => String(value || '').trim().toLowerCase();
const isAssigned = (student: any, uid: string) => [student.tutorId, student.staffId, student.assignedTutorId, student.assignedStaffId, student.instructorId].some(value => String(value || '') === uid);

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  try {
    const token = bearer(event);
    if (!token) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(token);
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists) return json(403, { error: 'Portal profile not found.' });
    const caller = callerSnap.data() || {};
    const callerRole = roleOf(caller.role);
    if (blocked(caller.accountStatus || caller.status)) return json(403, { error: 'Your account is not active.' });
    const isAdmin = ['admin', 'super_admin', 'content_admin', 'education_admin', 'services_admin', 'marketing_admin', 'support_admin'].includes(callerRole);
    const isTeachingStaff = ['staff', 'tutor', 'instructor'].includes(callerRole);
    const isSchool = callerRole === 'school';
    if (!isAdmin && !isTeachingStaff && !isSchool) return json(403, { error: 'You are not authorized to issue student credentials.' });

    const body = JSON.parse(event.body || '{}');
    const studentId = String(body.studentId || '').trim();
    if (!studentId) return json(400, { error: 'A student record is required.' });

    let studentRef: any = null;
    let student: any = null;
    for (const collectionName of ['individualStudents', 'students']) {
      const ref = adminDb.collection(collectionName).doc(studentId);
      const snap = await ref.get();
      if (snap.exists) { studentRef = ref; student = snap.data() || {}; break; }
    }
    if (!studentRef || !student) return json(404, { error: 'Student record not found.' });
    if (blocked(student.accountStatus || student.status)) return json(403, { error: 'This student account is not active.' });
    if (isTeachingStaff && !isAssigned(student, decoded.uid)) return json(403, { error: 'You can only issue credentials for students assigned to you.' });
    if (isSchool) { const schoolId = String(caller.schoolId || ''); if (!schoolId || String(student.schoolId || '') !== schoolId) return json(403, { error: 'You can only issue credentials for students in your school.' }); }

    const username = String(student.username || '').trim().toLowerCase();
    if (!username) return json(409, { error: 'This student does not have a portal username yet.' });
    const accessCode = makeCode();
    const accessCodeHash = hashCode(accessCode);
    const duplicate = await adminDb.collection('individualStudents').where('accessCodeHash', '==', accessCodeHash).limit(1).get();
    if (!duplicate.empty) return json(409, { error: 'A credential collision occurred. Please try again.' });

    const now = new Date();
    await studentRef.update({ accessCodeHash, portalAccessEnabled: true, accountStatus: 'ACTIVE', credentialIssuedAt: now, credentialIssuedBy: decoded.uid, updatedAt: now });
    if (student.firebaseUid || student.userId) {
      const uid = String(student.firebaseUid || student.userId);
      const authUser = await adminAuth.getUser(uid);
      if (authUser.disabled) await adminAuth.updateUser(uid, { disabled: false });
      await adminDb.collection('users').doc(uid).set({ portalAccessEnabled: true, accountStatus: 'ACTIVE', updatedAt: now }, { merge: true });
    }
    await adminDb.collection('activityLogs').add({ actorId: decoded.uid, action: 'STUDENT_CREDENTIAL_ISSUED', targetId: studentRef.id, targetType: 'student', schoolId: student.schoolId || null, timestamp: now, metadata: { username, issuedRole: callerRole } });
    return json(200, { student: { id: studentRef.id, fullName: student.fullName || student.studentName || 'Student', username, portal: '/portal' }, credentials: { username, accessCode, portal: '/portal' } });
  } catch (error) { console.error('Student credential issuance error:', error); return json(500, { error: 'Unable to issue student credentials.' }); }
};
