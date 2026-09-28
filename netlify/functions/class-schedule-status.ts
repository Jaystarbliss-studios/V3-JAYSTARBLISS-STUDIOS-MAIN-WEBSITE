import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb } from '../../api/_lib/firebase-admin';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});
const tokenFrom = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};
const normalize = (v: unknown) => String(v || '').trim().toLowerCase();
const tutorRoles = new Set(['TUTOR', 'STAFF', 'INSTRUCTOR', 'FACULTY']);
const adminRoles = new Set(['ADMIN', 'SUPER_ADMIN', 'EDUCATION_ADMIN', 'CMS_ADMIN']);
const dayName = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
const reasonRequired = (status: string) => ['ABSENT', 'CANCELLED', 'RESCHEDULED'].includes(status);

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  try {
    const token = tokenFrom(event);
    if (!token) return json(401, { error: 'Authentication required.' });
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const user = userSnap.exists ? userSnap.data() || {} : {};
    const role = String(user.role || '').toUpperCase();
    if (!tutorRoles.has(role) && !adminRoles.has(role)) return json(403, { error: 'You are not authorised to change class status.' });

    const body = JSON.parse(event.body || '{}');
    const scheduleId = String(body.scheduleId || '').trim();
    const status = String(body.status || '').trim().toUpperCase();
    const reason = String(body.reason || '').trim();
    if (!scheduleId || !status) return json(400, { error: 'scheduleId and status are required.' });
    if (reasonRequired(status) && !reason) return json(400, { error: 'A reason is required for this status.' });

    const scheduleRef = adminDb.collection('classSchedules').doc(scheduleId);
    const scheduleSnap = await scheduleRef.get();
    if (!scheduleSnap.exists) return json(404, { error: 'Class session not found.' });
    const schedule = scheduleSnap.data() || {};

    if (tutorRoles.has(role)) {
      const identities = new Set<string>([
        decoded.uid,
        String(user.tutorId || ''), String(user.staffId || ''), String(user.facultyId || ''), String(user.firebaseUid || '')
      ].filter(Boolean));
      const names = new Set([normalize(user.name), normalize(user.fullName), normalize(user.displayName)].filter(Boolean));
      const emails = new Set([normalize(decoded.email), normalize(user.email)].filter(Boolean));
      const owns = identities.has(String(schedule.tutorId || '')) || names.has(normalize(schedule.tutorName)) || emails.has(normalize(schedule.tutorEmail));
      if (!owns) return json(403, { error: 'This class is not assigned to you.' });
    }

    const actor = { statusUpdatedAt: new Date(), statusUpdatedBy: decoded.uid };
    if (status === 'RESCHEDULED') {
      const newDate = String(body.newDate || '').trim();
      const newStartTime = String(body.newStartTime || '').trim();
      const newEndTime = String(body.newEndTime || '').trim();
      if (!newDate || !newStartTime || !newEndTime || newEndTime <= newStartTime) return json(400, { error: 'A new date and valid new time range are required.' });
      if (newDate === String(schedule.date || '') && newStartTime === String(schedule.startTime || '')) return json(400, { error: 'The rescheduled class must have a new date or time.' });

      const replacementId = `${scheduleId}-rescheduled-${newDate}-${newStartTime.replace(':', '')}`;
      const replacementRef = adminDb.collection('classSchedules').doc(replacementId);
      await scheduleRef.set({
        status, rescheduleReason: reason, rescheduledToDate: newDate, rescheduledToStartTime: newStartTime, rescheduledToEndTime: newEndTime,
        ...actor, updatedAt: new Date()
      }, { merge: true });
      await replacementRef.set({
        ...schedule,
        id: replacementId,
        date: newDate,
        dayOfWeek: dayName(newDate),
        startTime: newStartTime,
        endTime: newEndTime,
        daySessionStartTime: newStartTime,
        daySessionEndTime: newEndTime,
        status: 'SCHEDULED',
        rescheduledFromId: scheduleId,
        rescheduledFromDate: schedule.date || '',
        rescheduledReason: reason,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusUpdatedAt: null,
        statusUpdatedBy: null
      }, { merge: true });
      return json(200, { ok: true, status: 'RESCHEDULED', replacementId, replacementDate: newDate, replacementStartTime: newStartTime, replacementEndTime: newEndTime });
    }

    const update: Record<string, unknown> = { status, ...actor, updatedAt: new Date() };
    if (status === 'ABSENT') update.absenceReason = reason;
    if (status === 'CANCELLED') update.cancellationReason = reason;
    await scheduleRef.set(update, { merge: true });
    return json(200, { ok: true, status });
  } catch (error) {
    console.error('class-schedule-status error:', error);
    return json(500, { error: error instanceof Error ? error.message : 'Unable to update class status.' });
  }
};
