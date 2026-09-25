import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Video, MapPin, ExternalLink, Users, Loader2, ChevronDown, ChevronRight, CheckCircle2, CircleAlert, Timer, BookOpen } from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import SEO from '../../components/ui/SEO';

type ScheduleStatus = 'upcoming' | 'ongoing' | 'completed' | 'absent' | 'cancelled' | 'rescheduled' | 'scheduled';

interface TimetableEvent {
  id: string;
  title: string;
  category: 'Class' | 'Exam' | 'Lab' | 'Workshop';
  dateMs: number;
  dateLabel: string;
  startTime: string;
  endTime: string;
  instructor: string;
  roomOrLink: string;
  isOnline: boolean;
  schoolId?: string;
  schoolName?: string;
  programmeId?: string;
  programmeName?: string;
  className?: string;
  status: ScheduleStatus;
  explicitStatus?: string;
  source: 'classSchedule' | 'link' | 'exam' | 'calendar';
}

const ordinal = (day: number) => {
  const suffix = day % 10 === 1 && day % 100 !== 11 ? 'st' : day % 10 === 2 && day % 100 !== 12 ? 'nd' : day % 10 === 3 && day % 100 !== 13 ? 'rd' : 'th';
  return `${day}${suffix}`;
};

const dateLabel = (ms: number) => {
  if (!ms) return 'Date not set';
  const d = new Date(ms);
  return `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${ordinal(d.getDate())} ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getFullYear()}`;
};

const categoryOf = (value: any): TimetableEvent['category'] => {
  const v = String(value || '').toLowerCase();
  if (v.includes('exam') || v.includes('quiz') || v.includes('assessment')) return 'Exam';
  if (v.includes('lab')) return 'Lab';
  if (v.includes('workshop')) return 'Workshop';
  return 'Class';
};

const parseDateMs = (value: any): number => {
  if (!value) return 0;
  if (value?.toDate instanceof Function) return value.toDate().getTime();
  if (typeof value === 'number') return value > 10_000_000_000 ? value : value * 1000;
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseTime = (value: any): { hours: number; minutes: number } | null => {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return { hours, minutes };
};

const combineDateAndTime = (dateMs: number, timeValue: any): number => {
  const parsed = parseTime(timeValue);
  if (!dateMs || !parsed) return dateMs;
  const d = new Date(dateMs);
  d.setHours(parsed.hours, parsed.minutes, 0, 0);
  return d.getTime();
};

const calculateStatus = (event: { startMs: number; endMs: number; explicitStatus?: string }): ScheduleStatus => {
  const explicit = String(event.explicitStatus || '').toLowerCase();
  if (['completed', 'absent', 'cancelled', 'canceled', 'rescheduled'].includes(explicit)) {
    return explicit === 'canceled' ? 'cancelled' : explicit as ScheduleStatus;
  }
  const now = Date.now();
  if (!event.startMs) return 'scheduled';
  if (now < event.startMs) return 'upcoming';
  if (event.endMs && now < event.endMs) return 'ongoing';
  return 'completed';
};

const statusMeta: Record<ScheduleStatus, { label: string; icon: React.ReactNode }> = {
  upcoming: { label: 'Upcoming', icon: <Timer size={15} /> },
  ongoing: { label: 'Ongoing now', icon: <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" /> },
  completed: { label: 'Completed', icon: <CheckCircle2 size={15} /> },
  absent: { label: 'Absent', icon: <CircleAlert size={15} /> },
  cancelled: { label: 'Cancelled', icon: <CircleAlert size={15} /> },
  rescheduled: { label: 'Rescheduled', icon: <CalendarIcon size={15} /> },
  scheduled: { label: 'Scheduled', icon: <CalendarIcon size={15} /> }
};

const buildEvent = (id: string, x: any, source: TimetableEvent['source'], defaults?: Partial<TimetableEvent>): TimetableEvent => {
  const dateMs = parseDateMs(x.date || x.startAt || x.meetingDate || x.scheduledAt || x.dueDate || x.createdAt);
  const startValue = x.startTime || x.start || x.meetingTime || x.time;
  const endValue = x.endTime || x.end;
  const startMs = combineDateAndTime(dateMs, startValue);
  const rawEndMs = combineDateAndTime(dateMs, endValue);
  const endMs = rawEndMs > startMs ? rawEndMs : startMs ? startMs + Number(x.durationMinutes || x.duration || 40) * 60_000 : 0;
  const status = calculateStatus({ startMs, endMs, explicitStatus: x.status });
  return {
    id,
    title: x.title || x.programmeName || x.programName || 'Class Session',
    category: categoryOf(x.category || x.type),
    dateMs,
    dateLabel: dateLabel(dateMs),
    startTime: startValue ? String(startValue) : dateMs ? new Date(startMs || dateMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Time not set',
    endTime: endValue ? String(endValue) : '',
    instructor: x.tutorName || x.instructorName || x.tutorEmail || 'Tutor not assigned',
    roomOrLink: x.url || x.link || x.location || '',
    isOnline: Boolean(x.url || x.link),
    schoolId: x.schoolId,
    schoolName: x.schoolName,
    programmeId: x.programmeId || x.programId || x.programme?.id,
    programmeName: x.programmeName || x.programName || x.programme?.name,
    className: x.className || x.classLevel || x.grade || x.class || 'All classes',
    status,
    explicitStatus: x.status,
    source,
    ...defaults
  };
};

export const PortalCalendar: React.FC = () => {
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState('ALL');
  const [selectedSchool, setSelectedSchool] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | ScheduleStatus>('ALL');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadSchedule = async () => {
      setLoading(true);
      setMessage('');
      try {
        const user = auth.currentUser;
        if (!user) return;
        const userSnap = await getDocs(query(collection(db, 'users'), where('firebaseUid', '==', user.uid), limit(1))).catch(() => null);
        const profile = userSnap?.docs[0]?.data() || {};
        const role = String(profile.role || sessionStorage.getItem('userRole') || '').toUpperCase();
        const studentId = sessionStorage.getItem('studentDocId') || profile.studentId || '';
        const schoolId = profile.schoolId || sessionStorage.getItem('schoolId') || '';
        const result = new Map<string, TimetableEvent>();

        const scheduleQueries: Promise<any>[] = [];
        if (studentId) scheduleQueries.push(getDocs(query(collection(db, 'classSchedules'), where('studentId', '==', studentId))));
        if (schoolId && ['SCHOOL', 'SCHOOL_ADMIN', 'ADMIN'].includes(role)) scheduleQueries.push(getDocs(query(collection(db, 'classSchedules'), where('schoolId', '==', schoolId))));
        if (['STAFF', 'TUTOR', 'INSTRUCTOR'].includes(role)) scheduleQueries.push(getDocs(query(collection(db, 'classSchedules'), where('tutorId', '==', user.uid))));
        if (!scheduleQueries.length) scheduleQueries.push(getDocs(query(collection(db, 'classSchedules'), where('userId', '==', user.uid))));
        const scheduleSnaps = await Promise.all(scheduleQueries);
        scheduleSnaps.forEach(snap => snap.forEach((d: any) => result.set(`schedule-${d.id}`, buildEvent(d.id, d.data(), 'classSchedule'))));

        const linkQueries: Promise<any>[] = [];
        if (studentId) linkQueries.push(getDocs(query(collection(db, 'personalLinks'), where('studentId', '==', studentId))));
        if (role === 'PARENT') {
          const childSnap = await getDocs(query(collection(db, 'individualStudents'), where('parentId', '==', user.uid))).catch(() => null);
          childSnap?.forEach(d => linkQueries.push(getDocs(query(collection(db, 'personalLinks'), where('studentId', '==', d.id)))));
        }
        const linkSnaps = await Promise.all(linkQueries);
        linkSnaps.forEach(snap => snap.forEach((d: any) => result.set(`link-${d.id}`, buildEvent(d.id, d.data(), 'link'))));

        const targetClass = profile.class || profile.grade || sessionStorage.getItem('studentClass') || '';
        if (targetClass) {
          const examSnap = await getDocs(query(collection(db, 'exams'), where('targetClass', '==', targetClass))).catch(() => null);
          examSnap?.forEach(d => result.set(`exam-${d.id}`, buildEvent(d.id, { ...d.data(), category: 'Exam' }, 'exam')));
        }

        const publicSnap = await getDocs(query(collection(db, 'calendarEvents'), where('visibility', '==', 'PUBLIC'), limit(100))).catch(() => null);
        publicSnap?.forEach(d => result.set(`public-${d.id}`, buildEvent(d.id, d.data(), 'calendar')));

        const list = Array.from(result.values()).sort((a, b) => a.dateMs - b.dateMs || a.startTime.localeCompare(b.startTime));
        setEvents(list);
        if (!list.length) setMessage('No class schedules are currently assigned to this account.');
      } catch (e) {
        console.error('Schedule loading failed:', e);
        setMessage('Schedule data could not be loaded. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void loadSchedule();
  }, []);

  const programmes = useMemo(() => Array.from(new Map(events.filter(e => e.programmeId || e.programmeName).map(e => [e.programmeId || e.programmeName || '', e.programmeName || 'Programme'])).entries()).map(([id, name]) => ({ id, name })), [events]);
  const schools = useMemo(() => Array.from(new Map(events.filter(e => e.schoolId).map(e => [e.schoolId || '', e.schoolName || 'School'])).entries()).map(([id, name]) => ({ id, name })), [events]);

  const filteredEvents = useMemo(() => events.filter(event => {
    const programmeMatch = selectedProgramme === 'ALL' || event.programmeId === selectedProgramme || event.programmeName === selectedProgramme;
    const schoolMatch = selectedSchool === 'ALL' || event.schoolId === selectedSchool;
    const statusMatch = selectedStatus === 'ALL' || event.status === selectedStatus;
    return programmeMatch && schoolMatch && statusMatch;
  }), [events, selectedProgramme, selectedSchool, selectedStatus]);

  const current = filteredEvents.find(e => e.status === 'ongoing');
  const next = filteredEvents.find(e => e.status === 'upcoming');

  const groupedWeeks = useMemo(() => {
    const groups = new Map<string, TimetableEvent[]>();
    filteredEvents.forEach(event => {
      const d = new Date(event.dateMs || Date.now());
      const monday = new Date(d);
      const day = monday.getDay() || 7;
      monday.setDate(monday.getDate() - day + 1);
      monday.setHours(0, 0, 0, 0);
      const key = monday.toISOString().slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(event);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEvents]);

  const toggleWeek = (week: string) => setExpandedWeeks(prev => ({ ...prev, [week]: prev[week] === false ? true : false }));

  return (
    <div className="space-y-5">
      <SEO title="Class Schedules | Jaystarbliss Studios" description="View programme-based class schedules and current class status." noindex={true} />

      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-5 md:p-7 bg-slate-950 text-white">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-brand-red text-[10px] font-black uppercase tracking-[0.18em] mb-2"><CalendarIcon size={14} /> Class Schedules</div>
              <h1 className="text-2xl md:text-3xl font-black">Your programme schedule</h1>
              <p className="mt-2 text-xs md:text-sm text-slate-300 max-w-2xl">Schedules are shown in chronological order and scoped to the authenticated account, school, programme, tutor assignment, or linked student.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {programmes.length > 0 && <select value={selectedProgramme} onChange={e => setSelectedProgramme(e.target.value)} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-bold text-white outline-none"><option value="ALL" className="text-slate-900">All programmes</option>{programmes.map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>)}</select>}
              {schools.length > 0 && <select value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-bold text-white outline-none"><option value="ALL" className="text-slate-900">All schools</option>{schools.map(s => <option key={s.id} value={s.id} className="text-slate-900">{s.name}</option>)}</select>}
              <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value as any)} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-bold text-white outline-none"><option value="ALL" className="text-slate-900">All statuses</option>{Object.keys(statusMeta).map(s => <option key={s} value={s} className="text-slate-900">{statusMeta[s as ScheduleStatus].label}</option>)}</select>
            </div>
          </div>
        </div>

        {(current || next) && (
          <div className="grid md:grid-cols-2 gap-3 p-4 md:p-5 border-b border-slate-200 dark:border-slate-800">
            {current && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"><div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Ongoing now</div><h2 className="mt-2 font-black text-slate-900 dark:text-white">{current.title}</h2><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{current.dateLabel} · {current.startTime}{current.endTime ? ` – ${current.endTime}` : ''}</p><p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-2">Tutor: {current.instructor}</p></div>}
            {next && <div className="rounded-2xl border border-brand-red/20 bg-brand-red/5 p-4"><div className="text-brand-red text-[10px] font-black uppercase tracking-wider">Next scheduled class</div><h2 className="mt-2 font-black text-slate-900 dark:text-white">{next.title}</h2><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{next.dateLabel} · {next.startTime}{next.endTime ? ` – ${next.endTime}` : ''}</p><p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-2">Tutor: {next.instructor}</p></div>}
          </div>
        )}
      </div>

      {loading ? <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="animate-spin mr-2" size={20} /> Loading schedules...</div> : !filteredEvents.length ? <div className="p-10 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">{message || 'No schedules match the selected filters.'}</div> : (
        <div className="space-y-3">
          {groupedWeeks.map(([week, weekEvents], index) => {
            const open = expandedWeeks[week] !== false && (index === 0 || Object.keys(expandedWeeks).length > 0);
            return <section key={week} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <button type="button" onClick={() => toggleWeek(week)} className="w-full flex items-center justify-between gap-4 p-4 md:p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <div><div className="text-[10px] font-black uppercase tracking-wider text-brand-red">Schedule week</div><h2 className="mt-1 text-sm md:text-base font-black text-slate-900 dark:text-white">{dateLabel(parseDateMs(week))}</h2><p className="text-[11px] text-slate-500 mt-1">{weekEvents.length} scheduled item{weekEvents.length === 1 ? '' : 's'}</p></div>{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {open && <div className="divide-y divide-slate-100 dark:divide-slate-800">{weekEvents.map(event => <article key={event.id} className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="w-full lg:w-36 shrink-0"><div className="text-xs font-black text-slate-900 dark:text-white">{event.dateLabel}</div><div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><Clock size={12} /> {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}</div></div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">{event.category}</span><span className="px-2 py-1 rounded-md bg-brand-red/10 text-brand-red text-[9px] font-black uppercase">{event.className}</span></div><h3 className="mt-2 text-sm font-black text-slate-900 dark:text-white">{event.title}</h3><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><Users size={12} /> {event.instructor}</span>{event.programmeName && <span className="inline-flex items-center gap-1"><BookOpen size={12} /> {event.programmeName}</span>}{event.schoolName && <span>{event.schoolName}</span>}</div></div>
                <div className="flex items-center justify-between lg:justify-end gap-3"><span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{statusMeta[event.status].icon}{statusMeta[event.status].label}</span>{event.isOnline && event.roomOrLink && <a href={event.roomOrLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-red text-white text-[10px] font-black hover:bg-red-700"><Video size={13} /> Join <ExternalLink size={11} /></a>}{!event.isOnline && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500"><MapPin size={12} /> {event.roomOrLink || 'Location pending'}</span>}</div>
              </article>)}</div>}
            </section>;
          })}
        </div>
      )}
    </div>
  );
};

export default PortalCalendar;
