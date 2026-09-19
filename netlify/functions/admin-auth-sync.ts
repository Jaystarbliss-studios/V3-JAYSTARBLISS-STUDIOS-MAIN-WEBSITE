import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

const tokenFromEvent = (event: any) => {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
};

const SUPER_ADMIN_EMAILS = new Set([
  'johnrufai242@gmail.com',
]);

const ADMIN_ROLES = new Set([
  'super_admin',
  'admin',
  'content_admin',
  'education_admin',
  'services_admin',
  'marketing_admin',
  'support_admin',
]);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  try {
    const token = tokenFromEvent(event);
    if (!token) return json(401, { error: 'Authentication required.' });

    const decoded = await adminAuth.verifyIdToken(token);
    const email = String(decoded.email || '').trim().toLowerCase();
    const uid = decoded.uid;

    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const existing = userSnap.exists ? userSnap.data() || {} : {};
    const existingRole = String(existing.role || '').toLowerCase();

    const isKnownSuperAdmin = SUPER_ADMIN_EMAILS.has(email);
    const hasAdminRole = ADMIN_ROLES.has(existingRole);

    if (isKnownSuperAdmin || hasAdminRole) {
      const assignedRole = isKnownSuperAdmin ? 'SUPER_ADMIN' : String(existing.role || 'ADMIN').toUpperCase();
      const updatedProfile = {
        ...existing,
        uid,
        email: existing.email || email,
        name: existing.name || existing.fullName || decoded.name || 'Administrator',
        fullName: existing.fullName || existing.name || decoded.name || 'Administrator',
        role: assignedRole,
        accountStatus: 'ACTIVE',
        status: 'ACTIVE',
        updatedAt: new Date(),
      };

      await userRef.set(updatedProfile, { merge: true });

      // Log the admin session verification
      await adminDb.collection('activityLogs').add({
        type: 'admin_session_sync',
        action: 'ADMIN_SESSION_SYNC',
        actorId: uid,
        actorEmail: email,
        role: assignedRole,
        timestamp: new Date(),
      }).catch(() => undefined);

      return json(200, {
        success: true,
        isAdmin: true,
        role: assignedRole,
        user: {
          uid,
          email,
          name: updatedProfile.name,
          role: assignedRole,
        },
      });
    }

    return json(200, {
      success: true,
      isAdmin: false,
      role: existingRole || 'USER',
    });
  } catch (error: any) {
    console.error('Admin auth sync error:', error);
    return json(500, { error: 'Unable to verify administrator session.' });
  }
};
