import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Code, CheckCircle2, ExternalLink, Award, Layers, Loader2, PlayCircle } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import SEO from '../../components/ui/SEO';

interface CourseModule {
  id: string;
  stage: number;
  stageName: string;
  title: string;
  description: string;
  topics: string[];
  lessonsCount: number;
  completedLessons: number;
  duration: string;
  badgeUnlocked: boolean;
}

const normalizeTopics = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
  if (typeof value === 'string') return value.split(/\n|,/).map(v => v.trim()).filter(Boolean);
  return [];
};

const toModule = (id: string, data: Record<string, any>, index: number): CourseModule => {
  const lessons = Number(data.lessonsCount ?? (Array.isArray(data.lessons) ? data.lessons.length : 0));
  return {
    id,
    stage: Number(data.stage ?? data.stageNumber ?? index + 1),
    stageName: data.stageName || data.stageTitle || `Stage ${index + 1}`,
    title: data.title || data.name || 'Untitled Course',
    description: data.shortDescription || data.description || 'Course details will appear here when published by the institute.',
    topics: normalizeTopics(data.topics ?? data.curriculum ?? data.modules),
    lessonsCount: Number.isFinite(lessons) ? lessons : 0,
    completedLessons: 0,
    duration: data.duration || data.durationLabel || 'Self-paced',
    badgeUnlocked: false
  };
};

export const PortalCourses: React.FC = () => {
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      setMessage('');
      try {
        const user = auth.currentUser;
        const programMap = new Map<string, CourseModule>();

        // Published programs are the authoritative curriculum catalogue.
        try {
          const snap = await getDocs(query(collection(db, 'programs'), where('status', '==', 'PUBLISHED')));
          snap.forEach((d, index) => programMap.set(d.id, toModule(d.id, d.data(), index)));
        } catch (e) {
          console.warn('Published programs query failed:', e);
        }

        // If a program has persisted learner progress, merge it without inventing completion.
        if (user) {
          const progressSources = ['courseProgress', 'studentProgress'];
          for (const source of progressSources) {
            try {
              const snap = await getDocs(query(collection(db, source), where('userId', '==', user.uid)));
              snap.forEach(d => {
                const p = d.data();
                const courseId = p.courseId || p.programId || p.moduleId;
                if (!courseId || !programMap.has(courseId)) return;
                const current = programMap.get(courseId)!;
                const completed = Number(p.completedLessons ?? p.lessonsCompleted ?? 0);
                programMap.set(courseId, {
                  ...current,
                  completedLessons: Math.max(0, Math.min(current.lessonsCount || completed, Number.isFinite(completed) ? completed : 0)),
                  badgeUnlocked: Boolean(p.badgeUnlocked || p.completed === true || (current.lessonsCount > 0 && completed >= current.lessonsCount))
                });
              });
            } catch (e) {
              console.warn(`${source} query failed:`, e);
            }
          }
        }

        const list = Array.from(programMap.values()).sort((a, b) => a.stage - b.stage || a.title.localeCompare(b.title));
        setModules(list);
        setSelectedId(prev => prev && list.some(m => m.id === prev) ? prev : list[0]?.id || '');
        if (!list.length) setMessage('No published courses are currently assigned or available.');
      } catch (e) {
        console.error('Course loading failed:', e);
        setMessage('Course data could not be loaded. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadCourses();
  }, []);

  const selectedModule = useMemo(() => modules.find(m => m.id === selectedId) || null, [modules, selectedId]);

  return (
    <div className="space-y-6">
      <SEO title="Curriculum & Course Tracks | Jaystarbliss Studios" description="View published Jaystarbliss Studios learning programs and your recorded course progress." noindex={true} />

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-red font-bold text-xs uppercase tracking-wider mb-1"><Layers size={14} /> Published Learning Catalogue</div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">Enrolled Course Tracks</h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">Course content and progress are sourced from persisted institute records.</p>
        </div>
        <a href="https://scratch.mit.edu" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-slate hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shrink-0"><Code size={14} className="text-brand-red" /> Launch Scratch IDE <ExternalLink size={12} /></a>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="animate-spin mr-2" size={20} /> Loading published courses...</div>
      ) : message && !modules.length ? (
        <div className="p-10 text-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-700 text-sm text-gray-500 dark:text-slate-400">{message}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 px-1">Published Programs</h2>
            {modules.map(mod => {
              const progress = mod.lessonsCount > 0 ? Math.round((mod.completedLessons / mod.lessonsCount) * 100) : 0;
              return <button key={mod.id} onClick={() => setSelectedId(mod.id)} className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedId === mod.id ? 'border-brand-red bg-white dark:bg-slate-900 shadow-md ring-1 ring-brand-red/20' : 'border-gray-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900'}`}>
                <div className="flex items-center justify-between mb-1.5 gap-2"><span className="text-[11px] font-extrabold uppercase text-brand-red truncate">{mod.stageName}</span>{mod.badgeUnlocked && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full"><Award size={10} /> Certified</span>}</div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-2 line-clamp-1">{mod.title}</h3>
                <div className="space-y-1"><div className="flex items-center justify-between text-[11px] text-gray-500"><span>{mod.lessonsCount ? `${mod.completedLessons} of ${mod.lessonsCount} lessons` : 'Lesson count not configured'}</span><span className="font-bold">{progress}%</span></div><div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className={`h-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-brand-red'}`} style={{ width: `${progress}%` }} /></div></div>
              </button>;
            })}
          </div>

          {selectedModule && <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><span className="px-3 py-1 bg-brand-red/10 text-brand-red font-bold text-xs rounded-lg uppercase tracking-wider">{selectedModule.stageName}</span><span className="text-xs text-gray-500 font-medium">Duration: {selectedModule.duration}</span></div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">{selectedModule.title}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">{selectedModule.description}</p>
              <div className="space-y-3 mb-6">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Core Subject Syllabus</h4>
                {selectedModule.topics.length ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{selectedModule.topics.map((topic, i) => <div key={i} className="p-3.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-950 flex items-center gap-3 text-xs font-semibold text-gray-800 dark:text-gray-200"><CheckCircle2 size={16} className="text-green-500 shrink-0" /><span>{topic}</span></div>)}</div> : <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-xs text-gray-500">The curriculum topics have not been configured for this program yet.</div>}
              </div>
            </div>
            <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500"><BookOpen size={16} className="text-brand-red" /><span>{selectedModule.lessonsCount ? `${selectedModule.completedLessons}/${selectedModule.lessonsCount} lessons recorded` : 'Lesson progress will appear when lessons are configured.'}</span></div>
              <button type="button" onClick={() => setMessage('Lesson delivery is connected to the published course record; an active lesson will appear here once one is assigned.')} className="px-5 py-2.5 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"><PlayCircle size={15} /> Resume Active Lesson</button>
            </div>
          </div>}
        </div>
      )}
      {message && modules.length > 0 && <div className="text-xs text-gray-500 dark:text-slate-400 px-1">{message}</div>}
    </div>
  );
};

export default PortalCourses;
