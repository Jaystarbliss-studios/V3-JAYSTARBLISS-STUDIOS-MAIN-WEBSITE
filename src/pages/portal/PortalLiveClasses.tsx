import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, ExternalLink, Loader2, Users, Video } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import SEO from '../../components/ui/SEO';

interface LiveLink {
  id: string;
  title: string;
  url: string;
  platform?: string;
  meetingTime?: string;
  studentId?: string;
  tutorId?: string;
  createdAt?: any;
}

interface AssignedStudent {
  id: string;
  fullName?: string;
  username?: string;
}

const PortalLiveClasses: React.FC = () => {
  const [links, setLinks] = useState<LiveLink[]>([]);
  const [students, setStudents] = useState<AssignedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadLiveClasses = async () => {
      setLoading(true);
      setMessage('');
      const user = auth.currentUser;
      if (!user) {
        setMessage('Your staff session is not available. Please sign in again.');
        setLoading(false);
        return;
      }

      try {
        const [linkSnap, studentSnapshots] = await Promise.all([
          getDocs(query(collection(db, 'personalLinks'), where('tutorId', '==', user.uid), limit(50))),
          Promise.all(
            ['tutorId', 'staffId', 'assignedTutorId', 'assignedStaffId', 'instructorId'].map(async (field) => {
              const snapshots = await Promise.all(
                ['individualStudents', 'students'].map(async (collectionName) => {
                  try {
                    return await getDocs(query(collection(db, collectionName), where(field, '==', user.uid), limit(50)));
                  } catch {
                    return null;
                  }
                })
              );
              return snapshots;
            })
          ),
        ]);

        if (cancelled) return;

        setLinks(
          linkSnap.docs
            .map((linkDoc) => ({ id: linkDoc.id, ...linkDoc.data() } as LiveLink))
            .sort((a, b) => String(b.createdAt?.seconds || 0).localeCompare(String(a.createdAt?.seconds || 0)))
        );

        const studentMap = new Map<string, AssignedStudent>();
        studentSnapshots.flat(2).filter(Boolean).forEach((snap: any) => {
          snap.docs.forEach((studentDoc: any) => {
            const data = studentDoc.data();
            studentMap.set(studentDoc.id, {
              id: studentDoc.id,
              fullName: data.fullName || data.studentName,
              username: data.username,
            });
          });
        });
        setStudents(Array.from(studentMap.values()));
      } catch (error) {
        console.error('Live class workspace loading failed:', error);
        if (!cancelled) setMessage('Live class data could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLiveClasses();
    return () => {
      cancelled = true;
    };
  }, []);

  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);

  return (
    <div className="dashboard-interface space-y-6 md:space-y-8">
      <SEO title="Live Classes | Staff Portal" description="Manage live classroom sessions published by Jaystarbliss Studios staff and tutors." noindex={true} />

      <section className="pro-surface rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-red"><Video size={14} aria-hidden="true" /> Teaching workspace</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Live Classes</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Review classroom links you have published and the cadets assigned to your staff account.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Assigned Cadets" value={students.length} icon={<Users size={18} />} />
            <Metric label="Published Sessions" value={links.length} icon={<Video size={18} />} />
          </div>
        </div>
      </section>

      {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">{message}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} /> Loading live class workspace…</div>
      ) : links.length === 0 ? (
        <section className="pro-surface rounded-3xl p-10 text-center">
          <Video size={36} className="mx-auto text-slate-300 dark:text-slate-700" aria-hidden="true" />
          <h2 className="mt-4 text-base font-black text-slate-900 dark:text-white">No live sessions published yet</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">Use the Staff Dashboard to select an assigned cadet and publish a Google Meet, Zoom, Teams, or lab session link.</p>
        </section>
      ) : (
        <section className="pro-surface rounded-3xl p-6 md:p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Published Sessions</h2>
              <p className="mt-1 text-xs text-slate-500">Links stored against your staff/tutor account.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {links.map((link) => {
              const student = link.studentId ? studentById.get(link.studentId) : undefined;
              return (
                <article key={link.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-md bg-brand-red/10 px-2 py-1 text-[10px] font-bold uppercase text-brand-red">{link.platform || 'Class Session'}</span>
                    {link.meetingTime && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500"><Clock size={11} aria-hidden="true" />{link.meetingTime}</span>}
                  </div>
                  <h3 className="mt-3 text-base font-black text-slate-900 dark:text-white">{link.title || 'Classroom Session'}</h3>
                  <div className="mt-3 space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2"><Users size={13} aria-hidden="true" /><span>{student?.fullName || student?.username || link.studentId || 'Assigned cadet'}</span></div>
                    <div className="flex items-center gap-2"><CalendarDays size={13} aria-hidden="true" /><span>{link.createdAt?.toDate?.().toLocaleDateString('en-NG') || 'Publication date not recorded'}</span></div>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-950">
                    Open Classroom <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
    <div className="flex items-center gap-2 text-brand-red">{icon}<span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span></div>
    <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
  </div>
);

export default PortalLiveClasses;
