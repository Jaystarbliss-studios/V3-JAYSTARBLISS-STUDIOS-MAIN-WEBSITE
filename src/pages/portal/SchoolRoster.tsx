import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, GraduationCap, Loader2, Plus, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

type Student = {
  id: string;
  collection: string;
  fullName: string;
  username: string;
  email: string | null;
  class: string;
  track: string;
  parentId: string | null;
  tutorId: string | null;
  staffId: string | null;
  portalAccessEnabled: boolean;
  accountStatus: string;
  source: string;
};

const SchoolRoster: React.FC = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/.netlify/functions/school-students', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load roster.');
      setStudents(result.students || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load roster.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return students;
    return students.filter(student => [student.fullName, student.username, student.email, student.class, student.track]
      .some(value => String(value || '').toLowerCase().includes(term)));
  }, [students, query]);

  return (
    <div className="space-y-6">
      <SEO title="Students Roster | Jaystarbliss Studios" description="Secure school learner roster and portal access management." noindex />
      <div className="pro-surface rounded-3xl p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-brand-red/10 p-3 text-brand-red"><GraduationCap size={24} /></div>
            <div>
              <div className="text-xs uppercase tracking-widest font-black text-brand-red">School Operations</div>
              <h1 className="text-2xl md:text-3xl font-black mt-1">Students Roster</h1>
              <p className="text-sm text-slate-500 mt-2 max-w-2xl">View only your school’s learners, their learning track, assignment status, and portal-access state. Access codes are intentionally never displayed here.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-black inline-flex items-center gap-2 disabled:opacity-50">
              {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Refresh
            </button>
            <Link to="/portal/school/onboard-student" className="min-h-11 rounded-xl bg-brand-red text-white px-4 text-xs font-black inline-flex items-center gap-2"><Plus size={16} /> Onboard Student</Link>
          </div>
        </div>
      </div>

      <div className="pro-surface rounded-2xl p-4 md:p-5">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, username, class or track" className="w-full min-h-11 rounded-xl border border-slate-200 pl-10 pr-3 bg-white dark:bg-slate-900 text-sm" />
          </div>
          <div className="text-xs font-bold text-slate-500">{filtered.length} of {students.length} learners</div>
        </div>
      </div>

      {loading ? (
        <div className="pro-surface rounded-2xl p-10 flex items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="animate-spin" size={20} /> Loading secure roster…</div>
      ) : students.length === 0 ? (
        <div className="pro-surface rounded-2xl p-10 text-center"><UserRound size={28} className="mx-auto text-slate-400" /><h2 className="font-black mt-3">No students yet</h2><p className="text-sm text-slate-500 mt-1">Start by onboarding the first learner into the shared Student Portal.</p><Link to="/portal/school/onboard-student" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-black text-white"><Plus size={16} /> Onboard first student</Link></div>
      ) : filtered.length === 0 ? (
        <div className="pro-surface rounded-2xl p-10 text-center"><Search size={28} className="mx-auto text-slate-400" /><h2 className="font-black mt-3">No matching learners</h2><p className="text-sm text-slate-500 mt-1">Try a different name, username, class or track.</p></div>
      ) : (
        <div className="pro-surface rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-slate-200/70 text-[11px] uppercase tracking-widest font-black text-slate-500"> <span>Learner</span><span>Class</span><span>Track</span><span>Portal</span><span>Assignment</span></div>
          <div className="divide-y divide-slate-200/70">
            {filtered.map(student => (
              <div key={`${student.collection}-${student.id}`} className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr] gap-3 md:gap-4 px-5 py-4 items-center">
                <div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-xl bg-brand-slate text-white flex items-center justify-center shrink-0"><UserRound size={18} /></div><div className="min-w-0"><div className="font-black text-sm truncate">{student.fullName || 'Unnamed learner'}</div><div className="text-xs text-slate-500 truncate">@{student.username || 'no-username'}{student.email ? ` · ${student.email}` : ''}</div></div></div>
                <div className="text-sm font-bold"><span className="md:hidden text-[10px] uppercase text-slate-400 mr-2">Class</span>{student.class || 'Not set'}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300"><span className="md:hidden text-[10px] uppercase text-slate-400 mr-2">Track</span>{student.track || 'General'}</div>
                <div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${student.portalAccessEnabled && student.accountStatus.toUpperCase() === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><ShieldCheck size={13} />{student.portalAccessEnabled && student.accountStatus.toUpperCase() === 'ACTIVE' ? 'Active' : 'Restricted'}</span></div>
                <div className="text-xs text-slate-500"><span className="md:hidden text-[10px] uppercase text-slate-400 mr-2">Teaching assignment</span>{student.tutorId || student.staffId ? 'Assigned staff' : 'Awaiting assignment'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3"><AlertCircle size={17} className="shrink-0 mt-0.5" /><p><strong>Credential safety:</strong> Student access codes are write-once credentials. They are shown only immediately after creation and are not recoverable from the roster.</p></div>
    </div>
  );
};

export default SchoolRoster;
