import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';
import type { QuerySnapshot } from 'firebase-admin/firestore';

const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const token = (event: any) => { const h = event.headers?.authorization || event.headers?.Authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; };
const roleOf = (v: unknown) => String(v || '').trim().toUpperCase();
const assignmentFields = ['tutorId', 'staffId', 'assignedTutorId', 'assignedStaffId', 'instructorId', 'assignedTo', 'assignedUserId'];
const assignmentCollections = ['tutorAssignments', 'staffAssignments', 'studentAssignments', 'learnerAssignments'];

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });
    const raw = token(event); if (!raw) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(raw);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return json(403, { error: 'Portal profile not found.' });
    const user = userSnap.data() || {};
    const role = roleOf(user.role);
    const docs = new Map<string, any>();
    const add = (snap: QuerySnapshot) => snap.forEach(d => docs.set(d.id, { id: d.id, ...d.data() }));
    const addStudentById = async (studentId: string) => {
      if (!studentId) return;
      for (const name of ['individualStudents', 'students']) {
        try {
          const snap = await adminDb.collection(name).doc(studentId).get();
          if (snap.exists) docs.set(snap.id, { id: snap.id, ...snap.data() });
        } catch (e) { console.warn(`Student lookup failed for ${name}/${studentId}`, e); }
      }
    };

    if (['TUTOR', 'STAFF', 'INSTRUCTOR'].includes(role)) {
      // Primary source: the assignment fields already stored on the learner record.
      for (const field of assignmentFields) {
        for (const name of ['individualStudents', 'students']) {
          try { add(await adminDb.collection(name).where(field, '==', decoded.uid).limit(200).get()); } catch (e) { console.warn(`Student roster query failed for ${name}.${field}`, e); }
        }
      }

      // Compatibility source: some older assignment workflows keep the relationship
      // in a dedicated assignment document. Resolve those records into the same global
      // roster so every tutor-facing tool sees the exact same assigned students.
      for (const collectionName of assignmentCollections) {
        for (const field of assignmentFields) {
          try {
            const snap = await adminDb.collection(collectionName).where(field, '==', decoded.uid).limit(200).get();
            for (const assignment of snap.docs) {
              const data = assignment.data() || {};
              const studentId = String(data.studentId || data.learnerId || data.cadetId || data.studentDocId || '').trim();
              await addStudentById(studentId);
            }
          } catch (e) { console.warn(`Tutor assignment compatibility query failed for ${collectionName}.${field}`, e); }
        }
      }
    } else if (role === 'PARENT') {
      add(await adminDb.collection('individualStudents').where('parentId', '==', decoded.uid).limit(100).get());
      add(await adminDb.collection('students').where('parentId', '==', decoded.uid).limit(100).get());
    } else if (role === 'SCHOOL') {
      const schoolId = String(user.schoolId || decoded.uid);
      add(await adminDb.collection('individualStudents').where('schoolId', '==', schoolId).limit(200).get());
      add(await adminDb.collection('students').where('schoolId', '==', schoolId).limit(200).get());
    } else if (role === 'STUDENT') {
      const studentDocId = String(user.studentDocId || '');
      if (studentDocId) await addStudentById(studentDocId);
      if (!docs.size) {
        add(await adminDb.collection('individualStudents').where('firebaseUid', '==', decoded.uid).limit(10).get());
        add(await adminDb.collection('students').where('firebaseUid', '==', decoded.uid).limit(10).get());
      }
    } else if (['ADMIN', 'SUPER_ADMIN', 'CONTENT_ADMIN', 'EDUCATION_ADMIN', 'SERVICES_ADMIN', 'MARKETING_ADMIN', 'SUPPORT_ADMIN'].includes(role)) {
      add(await adminDb.collection('individualStudents').limit(200).get());
      add(await adminDb.collection('students').limit(200).get());
    } else {
      return json(403, { error: 'This account does not have access to student learning records.' });
    }

    const students = Array.from(docs.values()).map(s => ({
      id: s.id,
      fullName: s.fullName || s.studentName || s.name || 'Student',
      username: s.username || '',
      email: s.email || '',
      plan: s.plan || s.programName || s.program || '',
      schoolId: s.schoolId || '',
      parentId: s.parentId || '',
      tutorId: s.tutorId || s.staffId || s.assignedTutorId || s.assignedStaffId || s.instructorId || '',
      firebaseUid: s.firebaseUid || s.userId || '',
    })).sort((a, b) => a.fullName.localeCompare(b.fullName));
    return json(200, { students });
  } catch (error) {
    console.error('Academic students error:', error);
    return json(500, { error: 'Unable to load the learning roster.' });
  }
};
