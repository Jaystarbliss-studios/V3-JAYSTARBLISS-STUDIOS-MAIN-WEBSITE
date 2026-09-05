import type { Handler } from '@netlify/functions';
import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const bearer = (event: any) => { const value = event.headers?.authorization || event.headers?.Authorization || ''; return value.startsWith('Bearer ') ? value.slice(7) : ''; };
const hashCode = (value: string) => createHash('sha256').update(value.trim().toUpperCase()).digest('hex');
const makeCode = () => `JBS-${randomBytes(6).toString('hex').toUpperCase()}`;
const isAdminRole = (role: unknown) => ['SUPER_ADMIN','super_admin','ADMIN','admin','CONTENT_ADMIN','EDUCATION_ADMIN','SERVICES_ADMIN','MARKETING_ADMIN','SUPPORT_ADMIN'].includes(String(role || '').trim());
const blocked = (value: unknown) => ['SUSPENDED','BANNED','DISABLED'].includes(String(value || 'ACTIVE').toUpperCase());

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  try {
    const token = bearer(event);
    if (!token) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(token);
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const caller = callerSnap.exists ? callerSnap.data() || {} : {};
    if (!callerSnap.exists || blocked(caller.accountStatus || caller.status) || !isAdminRole(caller.role)) return json(403, { error: 'Only an active administrator can manage school access codes.' });

    const body = JSON.parse(event.body || '{}');
    const schoolId = String(body.schoolId || '').trim();
    const requestedCode = String(body.accessCode || '').trim().toUpperCase();
    if (!schoolId) return json(400, { error: 'A school is required.' });
    const schoolRef = adminDb.collection('schools').doc(schoolId);
    const schoolSnap = await schoolRef.get();
    if (!schoolSnap.exists) return json(404, { error: 'School record not found.' });
    const school = schoolSnap.data() || {};
    if (blocked(school.accountStatus || school.status)) return json(403, { error: 'This school account is disabled.' });

    const accessCode = requestedCode || makeCode();
    if (accessCode.length < 8 || accessCode.length > 40 || !/^[A-Z0-9_-]+$/.test(accessCode)) return json(400, { error: 'Access code must be 8–40 characters using letters, numbers, hyphens or underscores.' });
    const accessCodeHash = hashCode(accessCode);
    const duplicate = await adminDb.collection('schools').where('accessCodeHash', '==', accessCodeHash).limit(2).get();
    if (duplicate.docs.some(doc => doc.id !== schoolId)) return json(409, { error: 'That access code is already assigned to another school.' });

    const now = new Date();
    await schoolRef.update({ accessCodeHash, accessCode: FieldValue.delete(), accessCodeUpdatedAt: now, accessCodeUpdatedBy: decoded.uid, updatedAt: now });
    await adminDb.collection('activityLogs').add({ actorId: decoded.uid, action: 'SCHOOL_ACCESS_CODE_ROTATED', targetId: schoolId, targetType: 'school', timestamp: now, metadata: { schoolName: school.name || school.schoolName || schoolId, issuedRole: caller.role } });

    return json(200, { school: { id: schoolId, name: school.name || school.schoolName || schoolId }, credentials: { accessCode, portal: '/portal' } });
  } catch (error) {
    console.error('School access code rotation failed:', error);
    return json(500, { error: 'Unable to rotate the school access code.' });
  }
};
