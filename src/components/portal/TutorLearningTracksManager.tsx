import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Loader2, RotateCcw, Save } from 'lucide-react';
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

interface Student { id: string; fullName?: string; name?: string; username?: string; plan?: string; track?: string; programName?: string; programTitle?: string; enrolledPrograms?: string[]; subjects?: string[]; currentProgramId?: string; currentProgramName?: string; learningTracks?: Track[]; }
interface Track { programId: string; programName: string; seriesName?: string; stageNumber?: number; stageName?: string; progress: number; completed: boolean; status: 'CURRENT' | 'COMPLETED' | 'UPCOMING'; completedAt?: string; }
interface Program { id: string; title: string; seriesName?: string; stageNumber: number; stageName?: string; lessonsCount?: number; }

const norm = (value: unknown) => String(value || '').trim().toLowerCase();
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));

const TutorLearningTracksManager: React.FC<{ studentId?: string }> = ({ studentId }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(studentId || '');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadStudents = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/academic-students', { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load assigned students.');
      const list = (result.students || []) as Student[];
      setStudents(list);
      if (selectedStudentId && list.some(student => student.id === selectedStudentId)) return;
      setSelectedStudentId(list[0]?.id || '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load assigned students.');
    }
  };

  const loadPrograms = async () => {
    const snap = await getDocs(query(collection(db, 'programs'), where('status', '==', 'PUBLISHED'))).catch(() => getDocs(collection(db, 'programs')));
    setPrograms(snap.docs.map((d: any, index: number) => {
      const data = d.data();
      return { id: d.id, title: data.title || data.name || 'Course', seriesName: data.seriesName || '', stageNumber: Number(data.stageNumber ?? data.stage ?? index + 1), stageName: data.stageName || '', lessonsCount: Number(data.lessonsCount || (Array.isArray(data.lessons) ? data.lessons.length : 0)) };
    }));
  };

  const loadStudentTracks = async (id: string) => {
    if (!id) { setTracks([]); setLoading(false); return; }
    setLoading(true); setMessage('');
    try {
      const [studentSnap, individualSnap, progressSnap] = await Promise.all([
        getDoc(doc(db, 'students', id)).catch(() => null),
        getDoc(doc(db, 'individualStudents', id)).catch(() => null),
        getDocs(query(collection(db, 'courseProgress'), where('studentId', '==', id), limit(100))).catch(() => ({ docs: [] } as any))
      ]);
      const data = studentSnap?.exists() ? studentSnap.data() : individualSnap?.exists() ? individualSnap.data() : {};
      const names = new Set<string>();
      [data.plan, data.track, data.programName, data.programTitle, data.currentProgramName, ...(Array.isArray(data.enrolledPrograms) ? data.enrolledPrograms : []), ...(Array.isArray(data.subjects) ? data.subjects : [])].filter(Boolean).forEach((value: any) => names.add(norm(value)));
      const matched = programs.filter(program => {
        const title = norm(program.title); const series = norm(program.seriesName);
        return names.size === 0 || Array.from(names).some(name => title === name || title.includes(name) || name.includes(title) || (series && (series === name || series.includes(name) || name.includes(series))));
      });
      const seriesNames = new Set(matched.map(p => norm(p.seriesName)).filter(Boolean));
      const all = [...matched, ...programs.filter(p => seriesNames.has(norm(p.seriesName)))];
      const uniquePrograms = Array.from(new Map(all.map(program => [program.id, program])).values()).sort((a, b) => a.stageNumber - b.stageNumber || a.title.localeCompare(b.title));
      const savedMap = new Map<string, Track>();
      (Array.isArray(data.learningTracks) ? data.learningTracks : []).forEach((track: Track) => savedMap.set(track.programId || norm(track.programName), track));
      const progressMap = new Map<string, any>();
      progressSnap.docs.forEach((d: any) => { const p = d.data(); progressMap.set(p.courseId || p.programId || p.moduleId, p); });
      const currentId = String(data.currentProgramId || '');
      const currentName = norm(data.currentProgramName || '');
      setTracks(uniquePrograms.map(program => {
        const saved = savedMap.get(program.id) || savedMap.get(norm(program.title));
        const progressDoc = progressMap.get(program.id);
        const progress = clamp(saved?.progress ?? progressDoc?.progress ?? (progressDoc?.completed ? 100 : 0));
        const completed = Boolean(saved?.completed || progressDoc?.completed || progress >= 100);
        const current = !completed && (saved?.status === 'CURRENT' || currentId === program.id || (!currentId && currentName === norm(program.title)));
        return { programId: program.id, programName: program.title, seriesName: program.seriesName, stageNumber: program.stageNumber, stageName: program.stageName, progress, completed, status: current ? 'CURRENT' : completed ? 'COMPLETED' : 'UPCOMING' };
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load learning tracks.');
      setTracks([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { void Promise.all([loadStudents(), loadPrograms()]); }, []);
  useEffect(() => { if (selectedStudentId && programs.length) void loadStudentTracks(selectedStudentId); }, [selectedStudentId, programs.length]);

  const selectedStudent = students.find(student => student.id === selectedStudentId);
  const currentTrack = tracks.find(track => track.status === 'CURRENT');

  const updateTrack = (programId: string, patch: Partial<Track>) => {
    setTracks(current => current.map(track => track.programId === programId ? { ...track, ...patch, progress: patch.completed ? 100 : clamp(patch.progress ?? track.progress) } : track));
  };

  const setCurrent = (programId: string) => {
    setTracks(current => current.map(track => track.programId === programId ? { ...track, status: 'CURRENT', completed: false } : track.status === 'COMPLETED' ? track : { ...track, status: 'UPCOMING', completed: false }));
  };

  const markComplete = (programId: string) => {
    setTracks(current => current.map(track => track.programId === programId ? { ...track, status: 'COMPLETED', completed: true, progress: 100, completedAt: new Date().toISOString() } : track));
  };

  const save = async () => {
    if (!selectedStudent) return;
    setSaving(true); setMessage('');
    try {
      const current = tracks.find(track => track.status === 'CURRENT' && !track.completed);
      const completedAt = new Date().toISOString();
      const savedTracks = tracks.map(track => ({ ...track, progress: clamp(track.progress), completed: track.completed || track.progress >= 100, status: track.completed || track.progress >= 100 ? 'COMPLETED' : track.status === 'CURRENT' ? 'CURRENT' : 'UPCOMING', ...(track.completed && !track.completedAt ? { completedAt } : {}) }));
      const currentAfterSave = savedTracks.find(track => track.status === 'CURRENT' && !track.completed) || current;
      const currentProgram = currentAfterSave || null;
      const studentPayload = {
        learningTracks: savedTracks,
        currentProgramId: currentProgram?.programId || null,
        currentProgramName: currentProgram?.programName || null,
        currentProgramStage: currentProgram?.stageNumber || null,
        currentProgramStageName: currentProgram?.stageName || null,
        programId: currentProgram?.programId || selectedStudent.programId || null,
        programName: currentProgram?.programName || selectedStudent.programName || selectedStudent.plan || null,
        programTitle: currentProgram?.programName || selectedStudent.programTitle || selectedStudent.plan || null,
        plan: currentProgram?.programName || selectedStudent.plan || null,
        track: currentProgram?.programName || selectedStudent.track || null,
        enrolledPrograms: savedTracks.map(track => track.programName),
        updatedAt: serverTimestamp(),
        learningTrackUpdatedBy: auth.currentUser?.uid || null,
        learningTrackUpdatedAt: serverTimestamp()
      };
      await Promise.all([
        setDoc(doc(db, 'students', selectedStudent.id), studentPayload, { merge: true }),
        setDoc(doc(db, 'individualStudents', selectedStudent.id), studentPayload, { merge: true }),
        setDoc(doc(db, 'users', selectedStudent.id), { ...studentPayload, studentDocId: selectedStudent.id }, { merge: true }),
        ...savedTracks.map(track => setDoc(doc(db, 'courseProgress', `${selectedStudent.id}_${track.programId}`), {
          studentId: selectedStudent.id,
          userId: selectedStudent.id,
          courseId: track.programId,
          programId: track.programId,
          programName: track.programName,
          seriesName: track.seriesName || '',
          stageNumber: track.stageNumber || 0,
          stageName: track.stageName || '',
          progress: clamp(track.progress),
          completed: Boolean(track.completed || track.progress >= 100),
          completedAt: track.completed || track.progress >= 100 ? (track.completedAt || completedAt) : null,
          updatedBy: auth.currentUser?.uid || null,
          updatedAt: serverTimestamp()
        }, { merge: true }))
      ]);
      setMessage(`Learning tracks saved for ${selectedStudent.fullName || selectedStudent.name || 'student'}.`);
      await loadStudentTracks(selectedStudent.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save learning tracks.');
    } finally { setSaving(false); }
  };

  const reset = () => { if (selectedStudentId) void loadStudentTracks(selectedStudentId); };

  if (!students.length && !loading) return <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">No students are currently assigned to your tutor workspace.</div>;
  return (
    <section className="pro-surface rounded-3xl p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-brand-red">Tutor controls</p><h2 className="text-xl font-black text-slate-900 dark:text-white">Enrolled Courses &amp; Learning Tracks</h2><p className="text-xs text-slate-500 mt-1">Mark stages complete, adjust progress, and move the student to the current stage in a programme series.</p></div>
        {students.length > 1 && <div className="min-w-[240px]"><label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Assigned student</label><select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="input"><option value="">Select student</option>{students.map(student => <option key={student.id} value={student.id}>{student.fullName || student.name || student.username || student.id}</option>)}</select></div>}
      </div>
      {message && <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 text-xs font-semibold text-slate-700 dark:text-slate-300">{message}</div>}
      {loading ? <div className="py-10 flex justify-center text-xs text-slate-500"><Loader2 className="animate-spin mr-2" size={17}/>Loading course sequence…</div> : (
        <>
          {currentTrack && <div className="rounded-2xl border border-brand-red/20 bg-brand-red/5 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-brand-red">Current programme</p><p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{currentTrack.programName}</p><p className="text-[11px] text-slate-500">{currentTrack.progress}% complete</p></div>}
          {!tracks.length ? <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-7 text-center text-xs text-slate-500">No published programme stages match this student’s assigned track yet.</div> : <div className="space-y-3">{tracks.map((track, index) => (
            <div key={track.programId} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-4">
              <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase text-slate-400">Stage {track.stageNumber || index + 1}</span>{track.status === 'CURRENT' && <span className="rounded-full bg-brand-red text-white px-2 py-0.5 text-[9px] font-black uppercase">Current</span>}{track.completed && <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[9px] font-black uppercase inline-flex items-center gap-1"><CheckCircle2 size={10}/> Completed</span>}</div><p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{track.programName}</p>{track.seriesName && <p className="text-[11px] text-slate-500">{track.seriesName}{track.stageName ? ` • ${track.stageName}` : ''}</p>}<div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-brand-red rounded-full" style={{ width: `${track.progress}%` }}/></div><p className="mt-1 text-[10px] text-slate-500">{track.progress}% progress</p></div>
                <div className="w-full xl:w-[330px] space-y-2"><label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Progress %<input type="number" min="0" max="100" value={track.progress} onChange={e => updateTrack(track.programId, { progress: clamp(Number(e.target.value)), completed: Number(e.target.value) >= 100 })} className="input mt-1"/></label><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setCurrent(track.programId)} disabled={track.completed} className="min-h-9 rounded-xl bg-slate-900 text-white px-3 text-[11px] font-black disabled:opacity-40">Set current</button><button type="button" onClick={() => markComplete(track.programId)} className="min-h-9 rounded-xl bg-emerald-600 text-white px-3 text-[11px] font-black">Mark complete</button><button type="button" onClick={() => updateTrack(track.programId, { progress: 0, completed: false, status: 'UPCOMING' })} className="min-h-9 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-[11px] font-black inline-flex items-center gap-1"><RotateCcw size={12}/> Reset</button></div></div>
              </div>
            </div>
          ))}</div>}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800"><button type="button" onClick={reset} disabled={saving} className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-black inline-flex items-center gap-2"><RotateCcw size={14}/> Reload</button><button type="button" onClick={() => void save()} disabled={saving || !tracks.length} className="min-h-10 rounded-xl bg-brand-red text-white px-5 text-xs font-black inline-flex items-center gap-2"><Save size={14}/>{saving ? 'Saving…' : 'Save learning progress'}</button></div>
        </>
      )}
    </section>
  );
};

export default TutorLearningTracksManager;
