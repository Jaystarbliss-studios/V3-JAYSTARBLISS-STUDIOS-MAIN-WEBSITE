import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock, Edit3, FileText, Loader2, Save, Umbrella, X, XCircle } from 'lucide-react';
import { collection, doc, getDocs, serverTimestamp, updateDoc, writeBatch, addDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { getEffectiveAuth } from '../../utils/impersonation';

type Schedule = {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  programName?: string;
  programId?: string;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  parentId?: string;
  parentEmail?: string;
  parentName?: string;
  tutorId?: string;
  tutorName?: string;
  tutorEmail?: string;
  meetingLink?: string;
  schoolId?: string;
  schoolName?: string;
  classLevel?: string;
  classLevels?: string[];
  targetType?: string;
  status?: string;
  deliveryMode?: 'online' | 'physical' | 'hybrid' | string;
  cancellationReason?: string;
  absenceReason?: string;
  rescheduleReason?: string;
  rescheduledToDate?: string;
  rescheduledToStartTime?: string;
  rescheduledToEndTime?: string;
};

const monday = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  const n = d.getDay();
  d.setDate(d.getDate() + (n === 0 ? -6 : 1 - n));
  return d.toISOString().slice(0, 10);
};
const label = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short' });
const statusLabel = (status?: string) => String(status || 'SCHEDULED').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const needsReason = (status: string) => ['ABSENT', 'RESCHEDULED', 'CANCELLED'].includes(status);

interface Props { tutorId?: string; tutorName?: string; assignedSchools?: any[]; assignedStudents?: any[]; }

export const StaffClassSchedulesManager: React.FC<Props> = ({ tutorId, tutorName }) => {
  const { toast } = useToast();
  const effective = getEffectiveAuth();
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [statusEditing, setStatusEditing] = useState<Schedule | null>(null);
  const [statusForm, setStatusForm] = useState({ status: 'SCHEDULED', reason: '', newDate: '', newStartTime: '', newEndTime: '' });
  const [form, setForm] = useState({ date: '', startTime: '', endTime: '', title: '', meetingLink: '' });
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [holidayWeek, setHolidayWeek] = useState<string | null>(null);
  const [holidayReason, setHolidayReason] = useState('Tutor holiday / no classes this week');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';
      let list: Schedule[] = [];
      try {
        const r = await fetch('/.netlify/functions/class-schedules', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (r.ok) list = (await r.json()).schedules || [];
      } catch { /* Firestore fallback below */ }
      if (!list.length) {
        const snap = await getDocs(collection(db, 'classSchedules'));
        list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Schedule));
      }
      const uid = tutorId || effective.effectiveUid || user?.uid;
      const name = (tutorName || effective.effectiveName || user?.displayName || '').toLowerCase();
      setRows(list.filter(s => (uid && s.tutorId === uid) || (name && s.tutorName && s.tutorName.toLowerCase() === name)));
    } catch (e) {
      console.warn('Tutor schedules failed:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [tutorId, tutorName, effective.effectiveUid, effective.effectiveName]);

  const filteredRows = useMemo(() => {
    const sorted = rows.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.startTime).localeCompare(String(b.startTime)));
    if (filterStatus === 'ALL') return sorted;
    return sorted.filter(r => String(r.status || 'SCHEDULED').toUpperCase() === filterStatus);
  }, [rows, filterStatus]);

  const weeks = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    filteredRows.forEach(r => {
      const w = monday(r.date);
      if (!map.has(w)) map.set(w, []);
      map.get(w)!.push(r);
    });
    return Array.from(map.entries());
  }, [filteredRows]);

  const openEdit = (r: Schedule) => {
    setEditing(r);
    setForm({ date: r.date, startTime: r.startTime || '', endTime: r.endTime || '', title: r.title || '', meetingLink: r.meetingLink || '' });
  };

  const openStatus = (r: Schedule) => {
    const status = String(r.status || 'SCHEDULED').toUpperCase();
    setStatusEditing(r);
    setStatusForm({
      status,
      reason: status === 'ABSENT' ? (r.absenceReason || '') : status === 'RESCHEDULED' ? (r.rescheduleReason || '') : (r.cancellationReason || ''),
      newDate: r.rescheduledToDate || '',
      newStartTime: r.rescheduledToStartTime || r.startTime || '',
      newEndTime: r.rescheduledToEndTime || r.endTime || ''
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      if (!form.date || !form.startTime || !form.endTime || form.endTime <= form.startTime) throw new Error('Please provide a valid date and time range.');
      await updateDoc(doc(db, 'classSchedules', editing.id), {
        date: form.date,
        dayOfWeek: new Date(`${form.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
        startTime: form.startTime,
        endTime: form.endTime,
        title: form.title.trim() || editing.title || 'Class session',
        meetingLink: form.meetingLink.trim(),
        updatedAt: serverTimestamp(),
        editedBy: effective.effectiveUid || auth.currentUser?.uid || null
      });
      toast.success('Class session updated.');
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Unable to update class session.');
    } finally { setSaving(false); }
  };

  const saveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusEditing) return;
    const next = statusForm.status.toUpperCase();
    if (needsReason(next) && !statusForm.reason.trim()) return toast.error(`Please enter the reason for marking this class ${statusLabel(next).toLowerCase()}.`);
    if (next === 'RESCHEDULED') {
      if (!statusForm.newDate || !statusForm.newStartTime || !statusForm.newEndTime || statusForm.newEndTime <= statusForm.newStartTime) {
        return toast.error('Please set the new date and a valid new time range for the rescheduled class.');
      }
      if (statusForm.newDate === statusEditing.date && statusForm.newStartTime === statusEditing.startTime) {
        return toast.error('The rescheduled class must have a new date or time.');
      }
    }

    setStatusSaving(true);
    try {
      const actorId = effective.effectiveUid || auth.currentUser?.uid || null;
      const baseUpdate: Record<string, any> = {
        status: next,
        updatedAt: serverTimestamp(),
        statusUpdatedAt: serverTimestamp(),
        statusUpdatedBy: actorId
      };
      if (next === 'ABSENT') baseUpdate.absenceReason = statusForm.reason.trim();
      if (next === 'CANCELLED') baseUpdate.cancellationReason = statusForm.reason.trim();

      if (next === 'RESCHEDULED') {
        baseUpdate.rescheduleReason = statusForm.reason.trim();
        baseUpdate.rescheduledToDate = statusForm.newDate;
        baseUpdate.rescheduledToStartTime = statusForm.newStartTime;
        baseUpdate.rescheduledToEndTime = statusForm.newEndTime;

        const replacementId = `${statusEditing.id}-rescheduled-${statusForm.newDate}-${statusForm.newStartTime.replace(':', '')}`;
        const replacementRef = doc(db, 'classSchedules', replacementId);
        await Promise.all([
          updateDoc(doc(db, 'classSchedules', statusEditing.id), baseUpdate),
          updateDoc(replacementRef, {
            id: replacementId,
            scheduleGroupId: statusEditing.scheduleGroupId || statusEditing.id,
            title: statusEditing.title || statusEditing.programName || 'Class session',
            programName: statusEditing.programName || '',
            programId: statusEditing.programId || '',
            studentId: statusEditing.studentId || '',
            studentName: statusEditing.studentName || '',
            studentEmail: statusEditing.studentEmail || '',
            parentId: statusEditing.parentId || '',
            parentEmail: statusEditing.parentEmail || '',
            parentName: statusEditing.parentName || '',
            schoolId: statusEditing.schoolId || '',
            schoolName: statusEditing.schoolName || '',
            classLevel: statusEditing.classLevel || '',
            classLevels: statusEditing.classLevels || [],
            targetType: statusEditing.targetType || 'parent',
            tutorId: statusEditing.tutorId || actorId || '',
            tutorName: statusEditing.tutorName || tutorName || '',
            tutorEmail: statusEditing.tutorEmail || '',
            deliveryMode: statusEditing.deliveryMode || 'online',
            meetingLink: statusEditing.meetingLink || '',
            date: statusForm.newDate,
            dayOfWeek: new Date(`${statusForm.newDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
            startTime: statusForm.newStartTime,
            endTime: statusForm.newEndTime,
            daySessionStartTime: statusForm.newStartTime,
            daySessionEndTime: statusForm.newEndTime,
            status: 'SCHEDULED',
            rescheduledFromId: statusEditing.id,
            rescheduledFromDate: statusEditing.date,
            rescheduledReason: statusForm.reason.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }).catch(async () => {
            // If a replacement with this deterministic ID already exists, update it instead.
            await updateDoc(replacementRef, {
              date: statusForm.newDate,
              dayOfWeek: new Date(`${statusForm.newDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
              startTime: statusForm.newStartTime,
              endTime: statusForm.newEndTime,
              status: 'SCHEDULED',
              rescheduledFromId: statusEditing.id,
              rescheduledReason: statusForm.reason.trim(),
              updatedAt: serverTimestamp()
            });
          })
        ]);
      } else {
        await updateDoc(doc(db, 'classSchedules', statusEditing.id), baseUpdate);
      }

      toast.success(next === 'RESCHEDULED' ? 'Class rescheduled. The new session has been added to the new date.' : `Class marked ${statusLabel(next).toLowerCase()}.`);
      setStatusEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Unable to update class status.');
    } finally { setStatusSaving(false); }
  };

  const markWeekHoliday = async () => {
    if (!holidayWeek) return;
    const ids = rows.filter(r => monday(r.date) === holidayWeek && !['COMPLETED', 'ABSENT', 'RESCHEDULED'].includes(String(r.status || '').toUpperCase())).map(r => r.id);
    if (!ids.length) { toast.info('There are no active sessions in that week.'); setHolidayWeek(null); return; }
    try {
      const batch = writeBatch(db);
      ids.forEach(id => batch.update(doc(db, 'classSchedules', id), { status: 'CANCELLED', cancellationReason: holidayReason.trim() || 'Tutor holiday / no classes this week', holidayWeek: true, updatedAt: serverTimestamp() }));
      await batch.commit();
      toast.success('The selected week has been marked as a holiday.');
      setHolidayWeek(null);
      await load();
    } catch (e: any) { toast.error(e.message || 'Unable to mark the week as a holiday.'); }
  };

  const counts = useMemo(() => rows.reduce((acc, r) => {
    const s = String(r.status || 'SCHEDULED').toUpperCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [rows]);

  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap gap-2">
      {['ALL', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'ATTENDED', 'ABSENT', 'CANCELLED', 'RESCHEDULED'].map(status => (
        <button key={status} type="button" onClick={() => setFilterStatus(status)} className={`rounded-xl px-3 py-2 text-[11px] font-black ${filterStatus === status ? 'bg-brand-red text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
          {statusLabel(status)}{status !== 'ALL' && <span className="ml-1 opacity-70">({counts[status] || 0})</span>}{status === 'ALL' && <span className="ml-1 opacity-70">({rows.length})</span>}
        </button>
      ))}
    </div>

    {loading ? <div className="min-h-40 grid place-items-center text-sm text-slate-500"><Loader2 className="animate-spin mr-2 inline" size={18}/> Loading your classes…</div> : !weeks.length ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">No classes match this status.</div> : weeks.map(([week, weekRows]) => <section key={week} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
        <div><p className="text-[10px] uppercase tracking-wider font-black text-brand-red">Teaching week</p><h3 className="text-sm font-black">Week of {label(week)}</h3><p className="text-[11px] text-slate-500">{weekRows.length} session{weekRows.length === 1 ? '' : 's'}</p></div>
        <button type="button" onClick={() => setHolidayWeek(week)} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 text-amber-700 px-3 py-2 text-[11px] font-black"><Umbrella size={13}/> Mark week as holiday</button>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">{weekRows.map(r => {
        const status = String(r.status || 'SCHEDULED').toUpperCase();
        return <div key={r.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="lg:w-40 shrink-0"><p className="text-xs font-black">{label(r.date)}</p><p className="text-[11px] text-slate-500 flex items-center gap-1"><Clock size={12}/> {r.startTime || '—'} – {r.endTime || '—'}</p></div>
          <div className="flex-1 min-w-0"><p className="text-sm font-black truncate">{r.title || r.programName || 'Class session'}</p><p className="text-[11px] text-slate-500">{r.studentName || r.programName || 'Student class'} · {statusLabel(status)}</p>{status === 'ABSENT' && r.absenceReason && <p className="text-[11px] text-rose-600 mt-1">Reason: {r.absenceReason}</p>}{status === 'RESCHEDULED' && <p className="text-[11px] text-amber-700 mt-1">{r.rescheduleReason || 'Rescheduled'}{r.rescheduledToDate ? ` · New session: ${label(r.rescheduledToDate)} ${r.rescheduledToStartTime || ''}–${r.rescheduledToEndTime || ''}` : ''}</p>}{status === 'CANCELLED' && r.cancellationReason && <p className="text-[11px] text-slate-500 mt-1">Reason: {r.cancellationReason}</p>}</div>
          <div className="flex items-center gap-2 shrink-0"><button type="button" onClick={() => openStatus(r)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black"><FileText size={13}/> Status</button><button type="button" onClick={() => openEdit(r)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black"><Edit3 size={13}/> Edit session</button></div>
        </div>;
      })}</div>
    </section>)}

    {editing && <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><form onSubmit={saveEdit} className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-base font-black">Edit class session</h3><p className="text-xs text-slate-500">Changes apply to this session only.</p></div><button type="button" onClick={() => setEditing(null)}><X size={18}/></button></div><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Session title" className="w-full rounded-xl border px-3 py-2.5 text-sm"/><div className="grid grid-cols-3 gap-2"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="rounded-xl border px-3 py-2.5 text-sm"/><input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="rounded-xl border px-3 py-2.5 text-sm"/><input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="rounded-xl border px-3 py-2.5 text-sm"/></div><input type="url" value={form.meetingLink} onChange={e => setForm({ ...form, meetingLink: e.target.value })} placeholder="Meeting link (online classes)" className="w-full rounded-xl border px-3 py-2.5 text-sm"/><button disabled={saving} className="w-full rounded-xl bg-brand-red text-white py-2.5 text-xs font-black inline-flex items-center justify-center gap-2">{saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save changes</button></form></div>}

    {statusEditing && <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"><form onSubmit={saveStatus} className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-brand-red">Class status</p><h3 className="text-base font-black">Update {statusEditing.title || statusEditing.programName || 'class session'}</h3><p className="text-xs text-slate-500">A reason is required for absent, cancelled or rescheduled sessions.</p></div><button type="button" onClick={() => setStatusEditing(null)}><X size={18}/></button></div><select value={statusForm.status} onChange={e => setStatusForm({ ...statusForm, status: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm font-bold">{['SCHEDULED','ONGOING','COMPLETED','ATTENDED','ABSENT','CANCELLED','RESCHEDULED'].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>{needsReason(statusForm.status) && <textarea required value={statusForm.reason} onChange={e => setStatusForm({ ...statusForm, reason: e.target.value })} rows={4} placeholder="Explain why this class was absent, cancelled or rescheduled..." className="w-full rounded-xl border p-3 text-sm"/>}{statusForm.status === 'RESCHEDULED' && <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3"><p className="text-xs font-black text-amber-900">New class date & time</p><div className="grid grid-cols-3 gap-2"><input type="date" required value={statusForm.newDate} onChange={e => setStatusForm({ ...statusForm, newDate: e.target.value })} className="rounded-xl border px-3 py-2.5 text-sm"/><input type="time" required value={statusForm.newStartTime} onChange={e => setStatusForm({ ...statusForm, newStartTime: e.target.value })} className="rounded-xl border px-3 py-2.5 text-sm"/><input type="time" required value={statusForm.newEndTime} onChange={e => setStatusForm({ ...statusForm, newEndTime: e.target.value })} className="rounded-xl border px-3 py-2.5 text-sm"/></div></div>}<button disabled={statusSaving} className="w-full rounded-xl bg-brand-red text-white py-2.5 text-xs font-black inline-flex items-center justify-center gap-2">{statusSaving ? <Loader2 size={14} className="animate-spin"/> : <CalendarClock size={14}/>} Save status</button></form></div>}

    {holidayWeek && <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4"><div className="flex items-center justify-between"><h3 className="text-base font-black">Mark week as holiday</h3><button onClick={() => setHolidayWeek(null)}><XCircle size={18}/></button></div><p className="text-xs text-slate-500">All active sessions in this teaching week will be marked cancelled with the holiday reason.</p><textarea value={holidayReason} onChange={e => setHolidayReason(e.target.value)} className="w-full rounded-xl border p-3 text-sm" rows={3}/><button onClick={() => void markWeekHoliday()} className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-xs font-black">Confirm holiday week</button></div></div>}
  </div>;
};

export default StaffClassSchedulesManager;
