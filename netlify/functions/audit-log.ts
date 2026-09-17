import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const token = (event: any) => { const value = event.headers?.authorization || event.headers?.Authorization || ''; return value.startsWith('Bearer ') ? value.slice(7) : ''; };
const clean = (value: unknown, max = 500) => String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  try {
    const raw = token(event);
    if (!raw) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(raw);
    const body = JSON.parse(event.body || '{}');
    const type = clean(body.type || 'activity', 80).toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    const details = body.details && typeof body.details === 'object' ? body.details : {};
    const safeDetails = Object.fromEntries(Object.entries(details).slice(0, 40).map(([key, value]) => [clean(key, 80), typeof value === 'string' ? clean(value, 500) : typeof value === 'number' || typeof value === 'boolean' ? value : clean(JSON.stringify(value), 500)]));
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const user = userSnap.exists ? userSnap.data() || {} : {};

    await adminDb.collection('activityLogs').add({
      type,
      action: clean(body.action || type, 120),
      message: clean(body.message || '', 500),
      description: clean(body.description || '', 1000),
      actorId: decoded.uid,
      userId: decoded.uid,
      userEmail: decoded.email || user.email || '',
      userType: clean(user.role || body.userType || 'USER', 80),
      route: clean(body.route || '', 300),
      method: clean(body.method || '', 20),
      details: safeDetails,
      userAgent: clean(event.headers?.['user-agent'] || '', 300),
      timestamp: new Date(),
      source: 'portal_audit_tracker'
    });
    return json(200, { recorded: true });
  } catch (error) {
    console.error('Audit log error:', error);
    return json(500, { error: 'Unable to record activity.' });
  }
};
