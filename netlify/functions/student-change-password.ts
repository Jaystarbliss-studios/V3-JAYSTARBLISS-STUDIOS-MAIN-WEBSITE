import type { Handler } from '@netlify/functions';
import { createHash } from 'node:crypto';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

const bearer = (event: any) => {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  try {
    const token = bearer(event);
    if (!token) return json(401, { error: 'Authentication required.' });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase().trim();

    const body = JSON.parse(event.body || '{}');
    const newPassword = String(body.newPassword || '').trim();

    if (!newPassword || newPassword.length < 8) {
      return json(400, { error: 'Password must be at least 8 characters long.' });
    }

    const sha256Hash = createHash('sha256').update(newPassword).digest('hex');
    const now = new Date();

    // 1. Update Firebase Auth password
    try {
      await adminAuth.updateUser(uid, { password: newPassword });
    } catch (authErr: any) {
      console.warn('Auth user password update warning:', authErr?.message);
    }

    // 2. Update user profile document in Firestore
    const userDocRef = adminDb.collection('users').doc(uid);
    const userSnap = await userDocRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    await userDocRef.set({
      passwordHash: sha256Hash,
      forcePasswordReset: false,
      mustResetPassword: false,
      passwordUpdatedAt: now,
      updatedAt: now
    }, { merge: true });

    // 3. Update student record if exists
    const studentDocId = userData.studentDocId;
    let updatedStudentRecord = false;

    if (studentDocId) {
      for (const coll of ['individualStudents', 'students']) {
        const sRef = adminDb.collection(coll).doc(studentDocId);
        const sSnap = await sRef.get();
        if (sSnap.exists) {
          await sRef.set({
            passwordHash: sha256Hash,
            accessCodeHash: sha256Hash,
            forcePasswordReset: false,
            mustResetPassword: false,
            passwordUpdatedAt: now,
            updatedAt: now
          }, { merge: true });
          updatedStudentRecord = true;
          break;
        }
      }
    }

    if (!updatedStudentRecord) {
      // Look up by firebaseUid or email
      for (const coll of ['individualStudents', 'students']) {
        let qSnap = await adminDb.collection(coll).where('firebaseUid', '==', uid).limit(1).get();
        if (qSnap.empty && email) {
          qSnap = await adminDb.collection(coll).where('email', '==', email).limit(1).get();
        }
        if (!qSnap.empty) {
          await qSnap.docs[0].ref.set({
            passwordHash: sha256Hash,
            accessCodeHash: sha256Hash,
            forcePasswordReset: false,
            mustResetPassword: false,
            passwordUpdatedAt: now,
            updatedAt: now
          }, { merge: true });
          break;
        }
      }
    }

    return json(200, {
      success: true,
      message: 'Password successfully updated. You can now use your new password to sign in.'
    });
  } catch (err: any) {
    console.error('Student password change error:', err);
    return json(500, { error: err.message || 'Failed to update password.' });
  }
};
