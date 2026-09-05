import type { Handler } from '@netlify/functions';
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
const blocked = (value: unknown) => ['SUSPENDED', 'BANNED', 'DISABLED'].includes(String(value || 'ACTIVE').toUpperCase());

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  try {
    const token = bearer(event);
    if (!token) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(token);
    const parentSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!parentSnap.exists) return json(403, { error: 'Portal profile not found.' });
    const parent = parentSnap.data() || {};
    const role = String(parent.role || '').trim().toLowerCase();
    if (role !== 'parent' || blocked(parent.accountStatus || parent.status)) return json(403, { error: 'Only an active parent account can submit an enrollment request.' });

    let body: any = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid request payload.' }); }
    const studentName = clean(body.studentName);
    const studentAge = clean(body.studentAge, 40);
    const plan = clean(body.plan, 120);
    const subjects = Array.isArray(body.subjects)
      ? body.subjects.map((subject: unknown) => clean(subject, 80)).filter(Boolean).slice(0, 12)
      : [];

    if (!studentName || !studentAge || !plan || subjects.length === 0) {
      return json(400, { error: 'Student name, age/grade, learning plan, and at least one subject are required.' });
    }

    const now = new Date();
    const ref = adminDb.collection('enrollment_requests').doc();
    const record = {
      studentName,
      studentAge,
      plan,
      subjects,
      parentId: decoded.uid,
      parentEmail: clean(parent.email || '', 160).toLowerCase(),
      parentName: clean(parent.name || parent.displayName || '', 160),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      source: 'parent_portal',
    };

    await ref.set(record);
    await adminDb.collection('activityLogs').add({
      actorId: decoded.uid,
      action: 'PARENT_ENROLLMENT_REQUEST_CREATED',
      targetId: ref.id,
      targetType: 'enrollment_request',
      timestamp: now,
      metadata: { studentName, plan, subjects },
    });

    return json(201, { request: { id: ref.id, ...record } });
  } catch (error) {
    console.error('Parent enrollment request error:', error);
    return json(500, { error: 'Unable to submit the enrollment request.' });
  }
};
