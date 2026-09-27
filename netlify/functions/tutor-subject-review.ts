import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';
import { createPortalNotification, sendDirectClientEmail } from '../../api/_lib/email';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

const tokenFromEvent = (event: any) => {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
};

const clean = (value: unknown, max = 2000) => String(value ?? '').trim().slice(0, max);
const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'EDUCATION_ADMIN', 'CONTENT_ADMIN']);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  try {
    const token = tokenFromEvent(event);
    if (!token) return json(401, { error: 'Authentication required.' });

    const decoded = await adminAuth.verifyIdToken(token);
    const actorSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const actor = actorSnap.data() || {};
    const actorRole = String(actor.role || '').toUpperCase();
    if (!ADMIN_ROLES.has(actorRole)) return json(403, { error: 'Only administrators can review tutor subject applications.' });

    const body = JSON.parse(event.body || '{}');
    const action = clean(body.action, 20).toLowerCase();
    const applicationIds = Array.isArray(body.applicationIds) ? body.applicationIds.map((id: unknown) => clean(id, 200)).filter(Boolean) : [];
    const reason = clean(body.reason, 1200);

    if (!['approve', 'reject'].includes(action)) return json(400, { error: 'Invalid review action.' });
    if (!applicationIds.length) return json(400, { error: 'At least one subject application is required.' });
    if (action === 'reject' && !reason) return json(400, { error: 'Please provide a reason for rejecting the subject request.' });

    const results: Array<{ id: string; tutorId: string; subjectName: string; status: string }> = [];
    const tutorGroups = new Map<string, { tutorId: string; email: string; name: string; rank: string; subjects: string[] }>();

    for (const applicationId of applicationIds) {
      const ref = adminDb.collection('tutorSubjectApplications').doc(applicationId);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const application = snap.data() || {};
      if (String(application.status || '').toLowerCase() !== 'pending') continue;

      const tutorId = clean(application.tutorId, 200);
      if (!tutorId) continue;
      const tutorSnap = await adminDb.collection('users').doc(tutorId).get();
      const tutor = tutorSnap.data() || {};
      const tutorEmail = clean(application.tutorEmail || tutor.email || '', 160).toLowerCase();
      const tutorName = clean(tutor.fullName || tutor.name || tutor.displayName || tutorEmail || 'Tutor', 160);
      const rank = clean(tutor.rank || tutor.tutorRank || tutor.title || 'Tutor', 100);
      const subjectName = clean(application.subjectName || application.subjectId || 'Subject', 160);

      await ref.update({
        status: action === 'approve' ? 'approved' : 'rejected',
        rejectionReason: action === 'reject' ? reason : null,
        reviewedAt: new Date(),
        reviewedBy: decoded.uid,
        reviewedByName: clean(actor.fullName || actor.name || actor.displayName || decoded.email || 'Administrator', 160)
      });

      if (action === 'approve') {
        const existing = await adminDb.collection('tutorSubjects')
          .where('tutorId', '==', tutorId)
          .where('subjectId', '==', application.subjectId)
          .limit(1)
          .get();
        if (existing.empty) {
          await adminDb.collection('tutorSubjects').add({
            tutorId,
            tutorEmail,
            subjectId: application.subjectId,
            subjectName,
            categoryId: application.categoryId || '',
            categoryName: application.categoryName || '',
            approvedAt: new Date(),
            approvedBy: decoded.uid
          });
        }
      }

      const group = tutorGroups.get(tutorId) || { tutorId, email: tutorEmail, name: tutorName, rank, subjects: [] };
      group.subjects.push(subjectName);
      if (!group.email && tutorEmail) group.email = tutorEmail;
      tutorGroups.set(tutorId, group);
      results.push({ id: applicationId, tutorId, subjectName, status: action === 'approve' ? 'approved' : 'rejected' });
    }

    for (const group of tutorGroups.values()) {
      const subjectLabel = group.subjects.join(', ');
      const approved = action === 'approve';
      const title = approved ? 'Subject application approved' : 'Subject application rejected';
      const message = approved
        ? `Your request to teach ${subjectLabel} has been approved. The approved subject${group.subjects.length > 1 ? 's are' : ' is'} now available on your tutor profile.`
        : `Your request to teach ${subjectLabel} was rejected. Reason: ${reason}`;

      await createPortalNotification({
        recipientId: group.tutorId,
        email: group.email || undefined,
        title,
        message,
        type: 'TUTOR_SUBJECT_REVIEW',
        data: { status: approved ? 'approved' : 'rejected', subjectNames: group.subjects, reason: approved ? null : reason }
      });

      if (group.email) {
        await sendDirectClientEmail({
          to: group.email,
          recipientName: group.name,
          subject: `Jaystarbliss Studios — Tutor Subject Request ${approved ? 'Approved' : 'Rejected'}`,
          message: approved
            ? `Hello ${group.name},\n\nYour subject request has been approved.\n\nApproved subject${group.subjects.length > 1 ? 's' : ''}: ${subjectLabel}\nTutor rank: ${group.rank}\n\nYou can now view these subjects in your tutor portal.`
            : `Hello ${group.name},\n\nYour subject request has been rejected.\n\nRequested subject${group.subjects.length > 1 ? 's' : ''}: ${subjectLabel}\nReason: ${reason}\n\nPlease review the feedback in your tutor portal before submitting another request.`
        }).catch((emailError) => console.error('Tutor subject email delivery failed:', emailError));
      }
    }

    return json(200, { success: true, reviewed: results.length, results });
  } catch (error: any) {
    console.error('Tutor subject review failed:', error);
    return json(500, { error: error?.message || 'Unable to review tutor subject application.' });
  }
};
