import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Video, MapPin, ExternalLink, Users, Loader2 } from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import SEO from '../../components/ui/SEO';

type Category = 'Class' | 'Exam' | 'Lab' | 'Workshop';

interface TimetableEvent {
  id: string;
  title: string;
  category: Category;
  day: string;
  time: string;
  instructor: string;
  roomOrLink: string;
  isOnline: boolean;
  createdAt?: any;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const categoryOf = (value: any): Category => {
  const v = String(value || '').toLowerCase();
  if (v.includes('exam') || v.includes('quiz') || v.includes('assessment')) return 'Exam';
  if (v.includes('lab')) return 'Lab';
  if (v.includes('workshop')) return 'Workshop';
  return 'Class';
};

const dayFromValue = (value: any): string => {
  if (!value) return 'Monday';
  if (value?.toDate) return value.toDate().toLocaleDateString('en-US', { weekday: 'long' });
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).split(/[,|-]/)[0].trim() : parsed.toLocaleDateString('en-US', { weekday: 'long' });
};

export const PortalCalendar: React.FC = () => {
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState('All');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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

        // Explicitly assigned live links. These are scoped to the current user or their linked children.
        const linkQueries: Promise<any>[] = [];
        if (studentId) linkQueries.push(getDocs(query(collection(db, 'personalLinks'), where('studentId', '==', studentId))));
        if (role === 'STUDENT') linkQueries.push(getDocs(query(collection(db, 'personalLinks'), where('userId', '==', user.uid))));
        if (role === 'STAFF' || role === 'TUTOR') linkQueries.push(getDocs(query(collection(db, 'personalLinks'), where('tutorId', '==', user.uid))));
        if (schoolId) linkQueries.push(getDocs(query(collection(db, 'personalLinks'), where('schoolId', '==', schoolId))));

        // Parents can see links for their explicitly linked children only.
        if (role === 'PARENT') {
          try {
            const childSnap = await getDocs(query(collection(db, 'individualStudents'), where('parentId', '==', user.uid)));
            childSnap.forEach(d => linkQueries.push(getDocs(query(collection(db, 'personalLinks'), where('studentId', '==', d.id)))));
          } catch (e) {
            console.warn('Parent child schedule lookup failed:', e);
          }
        }

        const linkSnaps = await Promise.all(linkQueries);
        linkSnaps.forEach(snap => snap.forEach((d: any) => {
          const x = d.data();
          const day = dayFromValue(x.date || x.startAt || x.meetingDate || x.meetingTime);
          result.set(`link-${d.id}`, {
            id: d.id,
            title: x.title || 'Live Class Session',
            category: categoryOf(x.category || x.type),
            day,
            time: x.meetingTime || x.time || (x.startAt?.toDate ? x.startAt.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Scheduled session'),
            instructor: x.tutorName || x.instructorName || x.tutorEmail || 'Assigned Instructor',
            roomOrLink: x.url || x.link || '',
            isOnline: Boolean(x.url || x.link),
            createdAt: x.createdAt
          });
        }));

        // Exams are queried by the student's/school's known cohort rather than downloading all exams.
        const targetClass = profile.class || profile.grade || sessionStorage.getItem('studentClass') || '';
        if (targetClass) {
          try {
            const examSnap = await getDocs(query(collection(db, 'exams'), where('targetClass', '==', targetClass)));
            examSnap.forEach(d => {
              const x = d.data();
              result.set(`exam-${d.id}`, {
                id: d.id,
                title: x.title || 'Assessment',
                category: 'Exam',
                day: dayFromValue(x.dueDate || x.date || x.scheduledAt),
                time: x.time || x.duration || 'Scheduled assessment',
                instructor: x.instructorName || x.createdByName || 'Curriculum Council',
                roomOrLink: x.url || x.link || '',
                isOnline: Boolean(x.url || x.link),
                createdAt: x.timestamp || x.createdAt
              });
            });
          } catch (e) {
            console.warn('Cohort exam lookup failed:', e);
          }
        }

        // Optional public calendar records can be added by administrators without exposing private events.
        try {
          const publicSnap = await getDocs(query(collection(db, 'calendarEvents'), where('visibility', '==', 'PUBLIC'), limit(100)));
          publicSnap.forEach(d => {
            const x = d.data();
            result.set(`public-${d.id}`, {
              id: d.id,
              title: x.title || 'Institute Event',
              category: categoryOf(x.category),
              day: dayFromValue(x.date || x.startAt),
              time: x.time || 'See event details',
              instructor: x.instructorName || x.hostName || 'Jaystarbliss Studios',
              roomOrLink: x.url || x.location || '',
              isOnline: Boolean(x.url),
              createdAt: x.createdAt
            });
          });
        } catch (e) {
          // Collection may not exist yet; the portal still works from assigned links/exams.
          console.info('No public calendar collection available:', e);
        }

        const list = Array.from(result.values()).sort((a, b) => a.day.localeCompare(b.day) || String(a.time).localeCompare(String(b.time)));
        setEvents(list);
        if (!list.length) setMessage('No scheduled classes, assessments, or institute events are currently available for your account.');
      } catch (e) {
        console.error('Schedule loading failed:', e);
        setMessage('Schedule data could not be loaded. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadSchedule();
  }, []);

  const filteredEvents = useMemo(() => events.filter(ev => {
    const matchDay = selectedDay === 'All' || ev.day === selectedDay;
    const matchCat = filterCategory === 'ALL' || ev.category.toUpperCase() === filterCategory;
    return matchDay && matchCat;
  }), [events, selectedDay, filterCategory]);

  return (
    <div className="space-y-6">
      <SEO title="Class Calendar & Live Schedules | Jaystarbliss Studios" description="View scheduled classroom sessions, assessments, practical labs, and institute events." noindex={true} />
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><div className="flex items-center gap-2 text-brand-red font-bold text-xs uppercase tracking-wider mb-1"><CalendarIcon size={14} /> Live Schedule</div><h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">Classroom & Lab Schedules</h1><p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">Only schedules relevant to your authenticated account, cohort, or linked children are displayed.</p></div>
          <button onClick={() => setSelectedDay('All')} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedDay === 'All' ? 'bg-brand-red text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'}`}>All Week</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">{DAYS.map(day => <button key={day} onClick={() => setSelectedDay(selectedDay === day ? 'All' : day)} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${selectedDay === day ? 'bg-brand-slate text-white' : 'bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-brand-red'}`}>{day}</button>)}</div>
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-semibold shrink-0">
          {['ALL','CLASS','LAB','EXAM'].map(cat => <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-2.5 py-1 rounded-lg transition-colors ${filterCategory === cat ? 'bg-brand-slate text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{cat === 'ALL' ? 'All' : cat === 'CLASS' ? 'Classes' : cat === 'LAB' ? 'Labs' : 'Exams'}</button>)}
        </div>
      </div>

      {loading ? <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="animate-spin mr-2" size={20} /> Loading your schedule...</div> : filteredEvents.length === 0 ? (
        <div className="p-10 text-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-700 text-sm text-gray-500 dark:text-slate-400">{message || 'No events match the selected filters.'}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{filteredEvents.map(event => <div key={event.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-brand-red/40 transition-all flex flex-col justify-between">
          <div><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md border border-brand-red/30 bg-brand-red/10 text-brand-red">{event.category}</span><span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">{event.day}</span></div><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2 leading-snug">{event.title}</h3><div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 mb-4"><div className="flex items-center gap-2 text-brand-red font-medium"><Clock size={13} /> {event.time}</div><div className="flex items-center gap-2 text-gray-500 dark:text-gray-400"><Users size={13} /> Instructor: <strong>{event.instructor}</strong></div><div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">{event.isOnline ? <Video size={13} className="text-blue-500" /> : <MapPin size={13} className="text-amber-500" />}<span>{event.isOnline ? 'Online session' : event.roomOrLink || 'Institute location'}</span></div></div></div>
          <div className="pt-3 border-t border-gray-100 dark:border-slate-800">{event.isOnline && event.roomOrLink ? <a href={event.roomOrLink} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-red hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"><Video size={14} /> Join Session <ExternalLink size={12} /></a> : <div className="text-center text-xs font-bold text-gray-500 py-1.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl">In-Person / Details Pending</div>}</div>
        </div>)}</div>
      )}
    </div>
  );
};

export default PortalCalendar;
