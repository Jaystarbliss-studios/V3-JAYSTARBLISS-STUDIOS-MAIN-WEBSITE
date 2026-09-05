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
  parentId: data.parentId || null,
  tutorId: data.tutorId || data.assignedTutorId || data.instructorId || null,
  staffId: data.staffId || data.assignedStaffId || null,
  portalAccessEnabled: data.portalAccessEnabled !== false,
  accountStatus: data.accountStatus || data.status || 'ACTIVE',
  source: data.source || 'existing',
  firebaseUid: data.firebaseUid || data.userId || null,
  schoolId: data.schoolId || '',
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
    if (role !== 'school' || blocked(caller.accountStatus || caller.status)) return json(403, { error: 'Only an active school account can view its roster.' });

    const schoolId = String(caller.schoolId || '').trim();
    if (!schoolId) return json(403, { error: 'This school account is not linked to a school.' });

    const [individualSnap, legacySnap] = await Promise.all([
      adminDb.collection('individualStudents').where('schoolId', '==', schoolId).limit(500).get(),
      adminDb.collection('students').where('schoolId', '==', schoolId).limit(500).get(),
    ]);

    const students = new Map<string, any>();
    individualSnap.docs.forEach(doc => students.set(doc.id, { id: doc.id, collection: 'individualStudents', ...serialise(doc.data() || {}) }));
    legacySnap.docs.forEach(doc => {
      if (!students.has(doc.id)) students.set(doc.id, { id: doc.id, collection: 'students', ...serialise(doc.data() || {}) });
    });

    const result = Array.from(students.values()).sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
    return json(200, { schoolId, count: result.length, students: result });
  } catch (error) {
    console.error('School roster lookup failed:', error);
    return json(500, { error: 'Unable to load the school roster.' });
  }
};
