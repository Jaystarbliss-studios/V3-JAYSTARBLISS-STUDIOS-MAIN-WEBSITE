import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const tokenFromEvent = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};

const blocked = (value: unknown) => ['SUSPENDED', 'BANNED', 'DISABLED'].includes(String(value || 'ACTIVE').toUpperCase());

const serialise = (data: Record<string, any>) => ({
  fullName: data.fullName || data.studentName || '',
  username: data.username || '',
  email: data.email || null,
  class: data.class || data.grade || '',
  track: data.track || '',
  tutorId: data.tutorId || data.assignedTutorId || data.instructorId || null,
  staffId: data.staffId || data.assignedStaffId || null,
  portalAccessEnabled: data.portalAccessEnabled !== false,
  accountStatus: data.accountStatus || data.status || 'ACTIVE',
  source: data.source || 'existing',
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });
  try {
    const token = tokenFromEvent(event);
    if (!token) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(token);
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists) return json(403, { error: 'Portal profile not found.' });
    const caller = callerSnap.data() || {};
    const role = String(caller.role || '').trim().toLowerCase();
    const isAdmin = ['admin', 'super_admin', 'content_admin', 'education_admin', 'services_admin', 'marketing_admin', 'support_admin'].includes(role);
    const isSchool = role === 'school';

    if ((!isSchool && !isAdmin) || blocked(caller.accountStatus || caller.status)) {
      return json(403, { error: 'Only an active school or administrative account can view its roster.' });
    }

    const params = event.queryStringParameters || {};
    let schoolId = String(params.schoolId || caller.schoolId || '').trim();
    let schoolName = String(caller.schoolName || caller.name || '').trim();

    if (!schoolId) {
      const sDoc = await adminDb.collection('schools').doc(decoded.uid).get();
      if (sDoc.exists) {
        schoolId = sDoc.id;
        schoolName = sDoc.data()?.name || schoolName;
      } else {
        const userEmail = (caller.email || decoded.email || '').toLowerCase();
        if (userEmail) {
          const byEmail = await adminDb.collection('schools').where('contactEmail', '==', userEmail).limit(1).get();
          if (!byEmail.empty) {
            schoolId = byEmail.docs[0].id;
            schoolName = byEmail.docs[0].data()?.name || schoolName;
          } else {
            const byEmail2 = await adminDb.collection('schools').where('email', '==', userEmail).limit(1).get();
            if (!byEmail2.empty) {
              schoolId = byEmail2.docs[0].id;
              schoolName = byEmail2.docs[0].data()?.name || schoolName;
            }
          }
        }
      }
    }

    if (!schoolId && !isAdmin) return json(403, { error: 'This school account is not linked to a school.' });

    const effectiveSchoolId = schoolId || decoded.uid;
    const [individualSnap, legacySnap, usersSnap] = await Promise.all([
      adminDb.collection('individualStudents').where('schoolId', '==', effectiveSchoolId).limit(500).get(),
      adminDb.collection('students').where('schoolId', '==', effectiveSchoolId).limit(500).get(),
      adminDb.collection('users').where('schoolId', '==', effectiveSchoolId).limit(500).get(),
    ]);

    const students = new Map<string, any>();
    individualSnap.docs.forEach(doc => students.set(doc.id, { id: doc.id, studentId: doc.id, collection: 'individualStudents', ...serialise(doc.data() || {}) }));
    legacySnap.docs.forEach(doc => {
      if (!students.has(doc.id)) students.set(doc.id, { id: doc.id, studentId: doc.id, collection: 'students', ...serialise(doc.data() || {}) });
    });
    usersSnap.docs.forEach(doc => {
      const data = doc.data() || {};
      const uRole = String(data.role || '').toUpperCase();
      if (!['STUDENT','SCHOLAR','CADET'].includes(uRole) && !data.studentDocId) return;
      const key = String(data.studentDocId || doc.id);
      if (!students.has(key)) students.set(key, { id: key, studentId: key, collection: 'users', ...serialise({ ...data, fullName: data.fullName || data.name, firebaseUid: doc.id }) });
    });

    const result = Array.from(students.values()).sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
    return json(200, { schoolId: effectiveSchoolId, schoolName, count: result.length, students: result });
  } catch (error) {
    console.error('School roster lookup failed:', error);
    return json(500, { error: 'Unable to load the school roster.' });
  }
};
