import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, Loader2, UserRound } from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { getEffectiveAuth } from '../../utils/impersonation';

interface Child { id: string; name: string; status?: string; plan?: string; track?: string; programName?: string; programTitle?: string; enrolledPrograms?: string[]; subjects?: string[]; currentProgramId?: string; currentProgramName?: string; learningTracks?: LearningTrack[]; }
interface LearningTrack { programId?: string; programName?: string; seriesName?: string; stageNumber?: number; stageName?: string; progress?: number; completed?: boolean; status?: string; }
interface Program { id: string; title: string; seriesName?: string; stageNumber: number; stageName?: string; lessonsCount?: number; }

const normalise = (value: unknown) => String(value || '').trim().toLowerCase();
const progressFrom = (track?: LearningTrack, progressDoc?: any, lessonsCount = 0) => {
  if (typeof track?.progress === 'number') return Math.max(0, Math.min(100, Math.round(track.progress)));
  if (progressDoc?.progress != null) return Math.max(0, Math.min(100, Math.round(Number(progressDoc.progress))));
  if (progressDoc?.completed === true) return 100;
  const completedLessons = Number(progressDoc?.completedLessons ?? progressDoc?.lessonsCompleted ?? 0);
  return lessonsCount > 0 ? Math.max(0, Math.min(100, Math.round((completedLessons / lessonsCount) * 100))) : 0;
};

const ParentLearningTracks: React.FC = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [progressDocs, setProgressDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [childLoading, setChildLoading] = useState(false);

  const loadChildren = async () => {
    const effective = getEffectiveAuth();
    const user = auth.currentUser;
    const uid = effective.effectiveUid || user?.uid || '';
    const email = normalise(effective.effectiveEmail || user?.email || '');
    if (!uid && !email) return;

    const map = new Map<string, Child>();
    const collect = (snap: any) => snap.forEach((d: any) => {
      const data = d.data();
      const matches = data.parentId === uid || data.parentId === email || normalise(data.parentEmail) === email;
      if (!matches) return;
      const key = normalise(data.firebaseUid || data.studentUid || data.username || data.email || data.fullName || d.id);
      const current = map.get(key);
      const candidate = { id: d.id, name: data.fullName || data.studentName || data.name || 'Student', ...data } as Child;
      if (!current || normalise(candidate.status) === 'active') map.set(key, candidate);
    });

    if (uid) {
      await Promise.all([
        getDocs(query(collection(db, 'students'), where('parentId', '==', uid))).then(collect).catch(() => undefined),
        getDocs(query(collection(db, 'individualStudents'), where('parentId', '==', uid))).then(collect).catch(() => undefined)
      ]);
    }
    if (email) {
      await Promise.all([
        getDocs(query(collection(db, 'students'), where('parentEmail', '==', email))).then(collect).catch(() => undefined),
        getDocs(query(collection(db, 'individualStudents'), where('parentEmail', '==', email))).then(collect).catch(() => undefined)
      ]);
    }
    const list = Array.from(map.values());
    setChildren(list);
    setSelectedChildId(prev => prev && list.some(c => c.id === prev) ? prev : list[0]?.id || '');
  };

  const loadTrackData = async (childId: string) => {
    if (!childId) return;
    setChildLoading(true);
    try {
      const [studentSnap, individualSnap, programsSnap, byStudent, byUser] = await Promise.all([
        getDocs(query(collection(db, 'students'), where('__name__', '==', childId), limit(1))).catch(() => ({ docs: [] } as any)),
        getDocs(query(collection(db, 'individualStudents'), where('__name__', '==', childId), limit(1))).catch(() => ({ docs: [] } as any)),
        getDocs(query(collection(db, 'programs'), where('status', '==', 'PUBLISHED'))).catch(() => getDocs(collection(db, 'programs'))),
        getDocs(query(collection(db, 'courseProgress'), where('studentId', '==', childId), limit(100))).catch(() => ({ docs: [] } as any)),
        getDocs(query(collection(db, 'courseProgress'), where('userId', '==', childId), limit(100))).catch(() => ({ docs: [] } as any))
      ]);
      const studentData = studentSnap.docs[0]?.data() || individualSnap.docs[0]?.data() || {};
      setChildren(current => current.map(child => child.id === childId ? { ...child, ...studentData, name: studentData.fullName || studentData.studentName || studentData.name || child.name } : child));
      setPrograms(programsSnap.docs.map((d: any, index: number) => {
        const data = d.data();
        return { id: d.id, title: data.title || data.name || 'Course', seriesName: data.seriesName || '', stageNumber: Number(data.stageNumber ?? data.stage ?? index + 1), stageName: data.stageName || '', lessonsCount: Number(data.lessonsCount || (Array.isArray(data.lessons) ? data.lessons.length : 0)) };
      }));
      const docs = [...byStudent.docs, ...byUser.docs].map((d: any) => ({ id: d.id, ...d.data() }));
      const unique = new Map<string, any>();
      docs.forEach(item => unique.set(item.courseId || item.programId || item.moduleId || item.id, item));
      setProgressDocs(Array.from(unique.values()));
    } finally {
      setChildLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => { void loadChildren(); }, []);
  useEffect(() => { void loadTrackData(selectedChildId); }, [selectedChildId]);

  const selectedChild = children.find(c => c.id === selectedChildId);
  const tracks = useMemo(() => {
    if (!selectedChild) return [];
    const names = new Set<string>();
    [selectedChild.plan, selectedChild.track, selectedChild.programName, selectedChild.programTitle, selectedChild.currentProgramName, ...(selectedChild.enrolledPrograms || []), ...(selectedChild.subjects || [])].filter(Boolean).forEach(value => names.add(normalise(value)));
    const matching = programs.filter(program => {
      const title = normalise(program.title);
      const series = normalise(program.seriesName);
      return names.size === 0 || Array.from(names).some(name => title === name || title.includes(name) || name.includes(title) || (series && (series === name || series.includes(name) || name.includes(series))));
    });
    const seriesNames = new Set(matching.map(p => normalise(p.seriesName)).filter(Boolean));
    const withSeries = programs.filter(p => seriesNames.has(normalise(p.seriesName)));
    const combined = [...matching, ...withSeries];
    const unique = new Map<string, Program>();
    combined.forEach(p => unique.set(p.id, p));
    const trackMap = new Map<string, LearningTrack>();
    (selectedChild.learningTracks || []).forEach(track => trackMap.set(track.programId || normalise(track.programName), track));
    return Array.from(unique.values()).sort((a, b) => a.stageNumber - b.stageNumber || a.title.localeCompare(b.title)).map(program => {
      const saved = trackMap.get(program.id) || trackMap.get(normalise(program.title));
      const progressDoc = progressDocs.find(p => (p.courseId || p.programId || p.moduleId) === program.id);
      const progress = progressFrom(saved, progressDoc, program.lessonsCount);
      const completed = Boolean(saved?.completed || progressDoc?.completed || progress >= 100);
      const current = !completed && (saved?.status === 'CURRENT' || saved?.status === 'current' || selectedChild.currentProgramId === program.id || (!selectedChild.currentProgramId && selectedChild.currentProgramName && normalise(selectedChild.currentProgramName) === normalise(program.title)));
      return { ...program, progress, completed, current };
    });
  }, [selectedChild, programs, progressDocs]);

  if (!children.length && !loading) return null;
  return (
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-red"><BookOpen size={14}/> Learning</div>
          <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Enrolled Courses &amp; Learning Tracks</h2>
          <p className="mt-1 text-xs text-slate-500">View each child’s enrolled course sequence and the progress recorded by their tutor.</p>
        </div>
        {children.length > 1 && <div className="min-w-[210px]"><label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Child</label><select value={selectedChildId} onChange={e => setSelectedChildId(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-xs font-bold">{children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}</select></div>}
      </div>
      {childLoading ? <div className="py-12 flex justify-center text-xs text-slate-500"><Loader2 className="animate-spin mr-2" size={17}/>Loading learning tracks…</div> : (
        <div className="space-y-3">
          {selectedChild?.currentProgramName && <div className="rounded-2xl border border-brand-red/20 bg-brand-red/5 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-brand-red">Current programme</p><p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{selectedChild.currentProgramName}</p></div>}
          {!tracks.length ? <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-7 text-center text-xs text-slate-500">No enrolled course stages have been configured for this student yet.</div> : tracks.map((track, index) => (
            <div key={track.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase text-slate-400">Stage {track.stageNumber || index + 1}</span>{track.current && <span className="rounded-full bg-brand-red text-white px-2 py-0.5 text-[9px] font-black uppercase">Current</span>}{track.completed && <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[9px] font-black uppercase inline-flex items-center gap-1"><CheckCircle2 size={10}/> Completed</span>}</div><h3 className="mt-1 text-sm font-black text-slate-900 dark:text-white">{track.title}</h3>{track.seriesName && <p className="text-[11px] text-slate-500 mt-0.5">{track.seriesName}{track.stageName ? ` • ${track.stageName}` : ''}</p>}</div><span className="text-sm font-black text-slate-900 dark:text-white">{track.progress}%</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-red transition-all" style={{ width: `${track.progress}%` }}/></div>
              <p className="mt-2 text-[10px] text-slate-500">{track.completed ? 'Tutor marked this stage complete.' : track.current ? 'This is the stage currently being taught.' : 'Enrolled / upcoming stage.'}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ParentLearningTracks;
