import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const tokenFromEvent = (event: any) => {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

const blocked = (value: unknown) =>
  ['DISABLED', 'SUSPENDED', 'BANNED'].includes(String(value || '').toUpperCase());

const adminRoles = new Set(['ADMIN', 'SUPER_ADMIN', 'EDUCATION_ADMIN']);

const TARGETS = [
  {
    email: 'peniellilystudent@gmail.com',
    names: ['Peniel Lily', 'Peniel Lily Montessori School'],
  },
  {
    email: 'studentseasystars@gmail.com',
    names: ['Easy Stars Early Years Academy'],
  },
  {
    email: 'southgold@gmail.com',
    names: ['South Gold Montessori', 'South Gold Montessori School'],
  },
  {
    email: 'sapphirestudent@gmail.com',
    names: ['Sapphire Explorer Montessori School'],
  },
];

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  try {
    const token = tokenFromEvent(event);
    if (!token) return json(401, { error: 'Authentication required.' });

    const decoded = await adminAuth.verifyIdToken(token);
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const caller = callerSnap.data() || {};
    const callerRole = String(caller.role || '').toUpperCase();
    const callerEmail = String(decoded.email || '').trim().toLowerCase();
    const isActiveAdmin = adminRoles.has(callerRole) && !blocked(caller.accountStatus || caller.status);

    // Admins may sync all approved mappings. An authenticated approved school
    // administrator may also self-heal their own missing school link after login.
    if (!isActiveAdmin && !callerEmail) {
      return json(403, { error: 'Only an authenticated administrator or approved school administrator can link a school account.' });
    }

    const schoolSnap = await adminDb.collection('schools').get();
    const schools = schoolSnap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() || {},
    }));

    const body = JSON.parse(event.body || '{}');
    const requestedEmail = String(body.email || '').trim().toLowerCase();
    if (!isActiveAdmin && body.scope === 'all') {
      return json(403, { error: 'Only an administrator can synchronize all school administrator mappings.' });
    }

    const targets = requestedEmail
      ? TARGETS.filter((target) => target.email.toLowerCase() === requestedEmail)
      : TARGETS;

    if (requestedEmail && targets.length !== 1) {
      return json(400, { error: 'That email is not one of the approved school administrator mappings.' });
    }

    if (!isActiveAdmin) {
      if (targets.length !== 1 || targets[0].email.toLowerCase() !== callerEmail) {
        return json(403, { error: 'This account is not an approved school administrator mapping.' });
      }
    }

    const results: any[] = [];

    for (const target of targets) {
      try {
        const authUser = await adminAuth.getUserByEmail(target.email);
        const wanted = new Set(target.names.map(normalize));

        const matches = schools.filter(({ data }) => {
          const names = [data.name, data.schoolName].filter(Boolean).map(normalize);
          return names.some((name) => wanted.has(name));
        });

        if (matches.length !== 1) {
          results.push({
            email: target.email,
            status: matches.length === 0 ? 'SCHOOL_NOT_FOUND' : 'AMBIGUOUS_SCHOOL_MATCH',
            uid: authUser.uid,
            matches: matches.map((m) => ({ schoolId: m.id, name: m.data.name || m.data.schoolName || '' })),
          });
          continue;
        }

        const school = matches[0];
        const schoolId = school.id;
        const schoolName = school.data.name || school.data.schoolName || target.names[0];
        const userRef = adminDb.collection('users').doc(authUser.uid);
        const schoolRef = adminDb.collection('schools').doc(schoolId);
        const existingUserSnap = await userRef.get();
        const existingUser = existingUserSnap.data() || {};

        const existingSchoolAdminUid = String(
          school.data.adminUid || school.data.administratorUid || school.data.adminId || ''
        ).trim();

        if (existingSchoolAdminUid && existingSchoolAdminUid !== authUser.uid) {
          results.push({
            email: target.email,
            uid: authUser.uid,
            schoolId,
            schoolName,
            status: 'SCHOOL_ALREADY_HAS_DIFFERENT_ADMIN',
            existingAdminUid: existingSchoolAdminUid,
          });
          continue;
        }

        await adminDb.runTransaction(async (transaction) => {
          transaction.set(
            userRef,
            {
              ...existingUser,
              uid: authUser.uid,
              email: authUser.email || target.email,
              role: 'SCHOOL',
              schoolId,
              schoolName,
              accountStatus: existingUser.accountStatus || 'ACTIVE',
              status: existingUser.status || 'ACTIVE',
              portalAccessEnabled: existingUser.portalAccessEnabled !== false,
              updatedAt: new Date(),
            },
            { merge: true }
          );

          transaction.set(
            schoolRef,
            {
              adminUid: authUser.uid,
              userId: authUser.uid,
              contactEmail: authUser.email || target.email,
              updatedAt: new Date(),
            },
            { merge: true }
          );

          transaction.set(adminDb.collection('activityLogs').doc(), {
            type: 'school_admin_linked',
            action: 'SCHOOL_ADMIN_LINKED_TO_EXISTING_SCHOOL',
            actorId: decoded.uid,
            targetId: authUser.uid,
            targetType: 'school_admin',
            schoolId,
            schoolName,
            userEmail: authUser.email || target.email,
            timestamp: new Date(),
          });
        });

        results.push({
          email: target.email,
          uid: authUser.uid,
          schoolId,
          schoolName,
          status: 'LINKED',
        });
      } catch (error: any) {
        results.push({
          email: target.email,
          status: error?.code === 'auth/user-not-found' ? 'AUTH_USER_NOT_FOUND' : 'FAILED',
          error: error?.code === 'auth/user-not-found'
            ? 'Firebase Authentication account does not exist.'
            : 'Unable to complete this mapping.',
        });
      }
    }

    const linked = results.filter((item) => item.status === 'LINKED').length;
    const failed = results.length - linked;

    return json(failed ? 207 : 200, {
      success: failed === 0,
      linked,
      failed,
      results,
    });
  } catch (error) {
    console.error('School administrator sync failed:', error);
    return json(500, { error: 'Unable to synchronize school administrator accounts.' });
  }
};
