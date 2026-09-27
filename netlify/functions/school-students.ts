import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

const bearer = (e: any) => {
  const h = e.headers?.authorization || e.headers?.Authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
};

const blocked = (v: unknown) => ['SUSPENDED', 'BANNED', 'DISABLED'].includes(String(v || 'ACTIVE').toUpperCase());
const adminRoles = ['admin', 'super_admin', 'content_admin', 'education_admin', 'services_admin', 'marketing_admin', 'support_admin'];
const staffRoles = ['staff', 'tutor', 'instructor', 'teacher'];

const serialise = (id: string, d: any, source: string) => ({
  id,
  studentId: id,
  collection: source,
  fullName: d.fullName || d.studentName || d.name || 'Student',
  username: d.username || id,
  email: d.email || null,
  class: (d.class || d.grade || d.classLevel || '').trim() || '',
  track: d.track || d.programName || d.plan || '',
  enrolledPrograms: Array.isArray(d.enrolledPrograms) ? d.enrolledPrograms : [],
  subjects: Array.isArray(d.subjects) ? d.subjects : [],
  schoolId: d.schoolId || null,
  schoolName: d.schoolName || d.school || '',
  parentId: d.parentId || null,
  tutorId: d.tutorId || d.assignedTutorId || d.instructorId || null,
  staffId: d.staffId || d.assignedStaffId || null,
  portalAccessEnabled: d.portalAccessEnabled !== false,
  accountStatus: d.accountStatus || d.status || 'ACTIVE'
});

export const handler: Handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

  try {
    const token = bearer(event);
    if (!token) return json(401, { error: 'Authentication required.' });

    const decoded = await adminAuth.verifyIdToken(token);
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists) return json(403, { error: 'Portal profile not found.' });

    const caller = callerSnap.data() || {};
    const role = String(caller.role || '').toLowerCase();
    if (blocked(caller.accountStatus || caller.status)) return json(403, { error: 'Your account is not active.' });

    const isAdmin = adminRoles.includes(role);
    const isSchool = role === 'school';
    const isStaff = staffRoles.includes(role);
    if (!isAdmin && !isSchool && !isStaff) return json(403, { error: 'Not authorised.' });

    const requested = String(event.queryStringParameters?.schoolId || '').trim();
    let schoolIds: string[] = [];

    if (isAdmin) {
      if (requested) {
        schoolIds = [requested];
      } else {
        const schSnap = await adminDb.collection('schools').limit(500).get();
        schoolIds = schSnap.docs.map(d => d.id);
      }
    } else if (isSchool) {
      const validSids = new Set<string>();
      let primarySchoolName = caller.schoolName || '';

      // 1. Direct schoolId on caller
      if (caller.schoolId) validSids.add(String(caller.schoolId).trim());
      if (caller.school_id) validSids.add(String(caller.school_id).trim());
      if (caller.schoolDocId) validSids.add(String(caller.schoolDocId).trim());

      // 2. School doc where id == decoded.uid
      const sd = await adminDb.collection('schools').doc(decoded.uid).get();
      if (sd.exists) {
        validSids.add(sd.id);
        const data = sd.data() || {};
        if (data.name) primarySchoolName = data.name;
        if (data.schoolCode) validSids.add(String(data.schoolCode).trim());
        if (data.schoolId) validSids.add(String(data.schoolId).trim());
      }

      // 3. School doc where contactEmail / email == caller.email or adminUid == decoded.uid
      const email = String(caller.email || decoded.email || '').toLowerCase();
      const queries = [
        email ? adminDb.collection('schools').where('contactEmail', '==', email).limit(5).get() : Promise.resolve({ docs: [] }),
        email ? adminDb.collection('schools').where('email', '==', email).limit(5).get() : Promise.resolve({ docs: [] }),
        adminDb.collection('schools').where('adminUid', '==', decoded.uid).limit(5).get(),
        adminDb.collection('schools').where('firebaseUid', '==', decoded.uid).limit(5).get()
      ];
      const results = await Promise.all(queries);
      results.forEach((snap: any) => {
        snap.docs.forEach((d: any) => {
          validSids.add(d.id);
          const data = d.data() || {};
          if (data.name && !primarySchoolName) primarySchoolName = data.name;
          if (data.schoolCode) validSids.add(String(data.schoolCode).trim());
          if (data.schoolId) validSids.add(String(data.schoolId).trim());
        });
      });

      if (requested) {
        validSids.add(requested);
      }

      schoolIds = Array.from(validSids).filter(Boolean);
      if (schoolIds.length === 0) return json(403, { error: 'School account is not linked to a school.' });
    } else {
      // Staff / Tutor
      const a = await adminDb.collection('staffSchoolAccess').doc(decoded.uid).get();
      const d = a.exists ? a.data() || {} : {};
      schoolIds = [
        ...(Array.isArray(d.schoolIds) ? d.schoolIds.map(String) : []),
        ...(d.schoolId ? [String(d.schoolId)] : []),
        ...(caller.schoolId ? [String(caller.schoolId)] : [])
      ];
      schoolIds = [...new Set(schoolIds.filter(Boolean))];
      if (requested) {
        if (!schoolIds.includes(requested)) return json(403, { error: 'You are not assigned to this school.' });
        schoolIds = [requested];
      }
    }

    const studentsMap = new Map<string, any>();
    const seenIdentity = new Set<string>();

    const recordIdentity = (d: any, id: string) => {
      const uname = String(d.username || '').toLowerCase().trim();
      const email = String(d.email || '').toLowerCase().trim();
      const uid = String(d.firebaseUid || d.userId || '').trim();
      const docId = String(d.studentDocId || id).trim();
      const name = String(d.fullName || d.studentName || d.name || '').toLowerCase().trim();
      const sId = String(d.schoolId || '').trim();

      if (id) seenIdentity.add(`id:${id}`);
      if (docId) seenIdentity.add(`docId:${docId}`);
      if (uid) seenIdentity.add(`uid:${uid}`);
      if (uname) seenIdentity.add(`u:${uname}`);
      if (email && !email.endsWith('.local')) seenIdentity.add(`e:${email}`);
      if (name && sId) seenIdentity.add(`name:${sId}:${name}`);
    };

    const isDuplicate = (d: any, id: string): boolean => {
      const uname = String(d.username || '').toLowerCase().trim();
      const email = String(d.email || '').toLowerCase().trim();
      const uid = String(d.firebaseUid || d.userId || '').trim();
      const docId = String(d.studentDocId || id).trim();
      const name = String(d.fullName || d.studentName || d.name || '').toLowerCase().trim();
      const sId = String(d.schoolId || '').trim();

      if (id && seenIdentity.has(`id:${id}`)) return true;
      if (docId && seenIdentity.has(`docId:${docId}`)) return true;
      if (uid && seenIdentity.has(`uid:${uid}`)) return true;
      if (uname && seenIdentity.has(`u:${uname}`)) return true;
      if (email && !email.endsWith('.local') && seenIdentity.has(`e:${email}`)) return true;
      if (name && sId && seenIdentity.has(`name:${sId}:${name}`)) return true;
      return false;
    };

    const addStudent = (id: string, d: any, source: string) => {
      if (isDuplicate(d, id)) return;
      recordIdentity(d, id);
      studentsMap.set(id, serialise(id, d, source));
    };

    for (const sid of schoolIds) {
      // 1. Primary school student tables
      for (const coll of ['students', 'individualStudents']) {
        const snap = await adminDb.collection(coll).where('schoolId', '==', sid).limit(500).get();
        snap.docs.forEach(x => addStudent(x.id, x.data(), coll));
      }

      // 2. User accounts table (only if student hasn't been added from primary tables)
      const uSnap = await adminDb.collection('users').where('schoolId', '==', sid).limit(500).get();
      uSnap.docs.forEach(x => {
        const d = x.data() || {};
        const r = String(d.role || '').toUpperCase();
        if (['STUDENT', 'SCHOLAR', 'CADET'].includes(r) || d.studentDocId || d.isStudent) {
          const primaryId = String(d.studentDocId || x.id);
          addStudent(primaryId, { ...d, firebaseUid: x.id }, 'users');
        }
      });
    }

    if (isStaff) {
      for (const coll of ['students', 'individualStudents']) {
        for (const field of ['tutorId', 'staffId', 'assignedTutorId', 'assignedStaffId', 'instructorId']) {
          const snap = await adminDb.collection(coll).where(field, '==', decoded.uid).limit(500).get();
          snap.docs.forEach(x => addStudent(x.id, x.data(), coll));
        }
      }
    }

    const studentList = [...studentsMap.values()]
      .filter(x => !blocked(x.accountStatus))
      .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));

    return json(200, {
      schoolIds,
      count: studentList.length,
      students: studentList
    });
  } catch (e) {
    console.error('school-students handler error:', e);
    return json(500, { error: 'Unable to load the authorised student roster.' });
  }
};
