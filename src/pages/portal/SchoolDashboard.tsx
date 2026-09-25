import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Award, BookOpen, Calendar, ChevronRight, Copy, CreditCard, ExternalLink, Eye, Key, Link2, Loader2, Search, Users, X, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import SEO from '../../components/ui/SEO';
import DashboardGreeting from '../../components/portal/DashboardGreeting';
import ResourceLibrary from './ResourceLibrary';
import SchoolClassScheduleTimeline from '../../components/portal/SchoolClassScheduleTimeline';
import { auth, db } from '../../lib/firebase';
import { formatNaira } from '../../lib/billing';
import { useToast } from '../../contexts/ToastContext';
import { getEffectiveAuth } from '../../utils/impersonation';

export type SchoolDashboardTab = 'overview' | 'roster' | 'exams' | 'passcodes' | 'resources' | 'links' | 'schedules' | 'partnership';
export interface SchoolDashboardProps { initialTab?: SchoolDashboardTab; }
type SchoolRecord = { 
  id: string; 
  name?: string; 
  plan?: string; 
  coordinator?: string; 
  labDays?: string; 
  email?: string; 
  status?: string; 
  billing?: { 
    baseAmount?: number; 
    cycle?: string; 
    mode?: string; 
    status?: string; 
    nextDueDate?: string; 
    notes?: string; 
    allowedModes?: string[]; 
    lastReminderSentAt?: string; 
  };
  programs?: any[];
};
type Passcode = { id: string; classLevel: string; subject?: string; examTitle: string; passcode: string; isActive: boolean; validUntil?: string; invigilatorName?: string; allocatedCadetsCount?: number; };
type Exam = { id: string; title: string; subject?: string; term?: string; duration?: string; link?: string; url?: string; fileUrl?: string; status?: string; date?: string; targetClass?: string; description?: string; passcodeProtected?: boolean; };
type SchoolLink = { id: string; title: string; url: string; description?: string; };
type ClassSchedule = { id:string; date:string; startTime:string; endTime:string; classLevel:string; title:string; tutorName?:string; status:string; };

const jsonFetch = async <T,>(url: string): Promise<T> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Your session has expired. Please sign in again.');
  const token = await user.getIdToken();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Unable to complete the request.');
  return result as T;
};

const getEmbeddableUrl = (url: string) => {
  if (!url) return '';
  const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (gdMatch) return `https://docs.google.com/viewer?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${gdMatch[1]}`)}&embedded=true`;
  const gdOpen = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (gdOpen) return `https://drive.google.com/file/d/${gdOpen[1]}/preview`;
  if (url.includes('dropbox.com') && !url.includes('dropboxusercontent.com')) return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
  if (url.includes('1drv.ms') || url.includes('onedrive.live.com')) return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  return url;
};

const SchoolDashboard: React.FC<SchoolDashboardProps> = ({ initialTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const effective = getEffectiveAuth();
  const [tab, setTab] = useState<SchoolDashboardTab>(initialTab || 'overview');
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [passcodes, setPasscodes] = useState<Passcode[]>([]);
  const [classSchedules, setClassSchedules] = useState<ClassSchedule[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [links, setLinks] = useState<SchoolLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reader, setReader] = useState<{ url: string; title: string } | null>(null);
  const [readerLoading, setReaderLoading] = useState(true);
  const [passcodeForm, setPasscodeForm] = useState<Partial<Passcode> | null>(null);

  const resolvedTab = useCallback((): SchoolDashboardTab => {
    if (initialTab) return initialTab;
    const path = location.pathname.toLowerCase();
    if (path.includes('/roster')) return 'roster';
    if (path.includes('/exams')) return 'exams';
    if (path.includes('/passcodes')) return 'passcodes';
    if (path.includes('/resources')) return 'resources';
    if (path.includes('/links')) return 'links';
    if (path.includes('/schedules')) return 'schedules';
    if (path.includes('/partnership')) return 'partnership';
    const requested = searchParams.get('tab') as SchoolDashboardTab;
    return ['overview','roster','exams','passcodes','resources','links','schedules','partnership'].includes(requested) ? requested : 'overview';
  }, [initialTab, location.pathname, searchParams]);

  useEffect(() => setTab(resolvedTab()), [resolvedTab]);
  const changeTab = (next: SchoolDashboardTab) => { setTab(next); navigate(next === 'overview' ? '/portal/school' : `/portal/school/${next}`); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const effective = getEffectiveAuth();
      if (!auth.currentUser && !effective.isMasquerading) throw new Error('Authentication required.');

      let schoolId = effective.effectiveSchoolId || sessionStorage.getItem('schoolId') || '';
      let schoolRecordData: SchoolRecord | null = null;

      // 1. If we have a direct schoolId, check schools collection
      if (schoolId) {
        try {
          const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
          if (schoolSnap.exists()) {
            schoolRecordData = { ...(schoolSnap.data() as Omit<SchoolRecord, 'id'>), id: schoolSnap.id };
          }
        } catch (e) {
          console.warn('Direct school lookup error:', e);
        }
      }

      // 2. If not found, check by effective UID in users collection
      if (!schoolRecordData && effective.effectiveUid) {
        try {
          const userSnap = await getDoc(doc(db, 'users', effective.effectiveUid));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            const sId = String(uData.schoolId || '').trim();
            if (sId) {
              schoolId = sId;
              const schoolSnap = await getDoc(doc(db, 'schools', sId));
              if (schoolSnap.exists()) {
                schoolRecordData = { ...(schoolSnap.data() as Omit<SchoolRecord, 'id'>), id: schoolSnap.id };
              }
            }
          }
        } catch (e) {
          console.warn('User profile school lookup error:', e);
        }
      }

      // 3. If still not found, find in schools collection by matching ID or email or adminUid
      if (!schoolRecordData) {
        try {
          const schoolsSnap = await getDocs(collection(db, 'schools'));
          const found = schoolsSnap.docs.find(d => 
            d.id === schoolId || 
            d.id === effective.effectiveUid ||
            d.data().email?.toLowerCase() === effective.effectiveEmail?.toLowerCase() ||
            d.data().firebaseUid === effective.effectiveUid ||
            d.data().adminUid === effective.effectiveUid
          );
          if (found) {
            schoolId = found.id;
            schoolRecordData = { ...(found.data() as Omit<SchoolRecord, 'id'>), id: found.id };
          }
        } catch (e) {
          console.warn('Schools collection lookup error:', e);
        }
      }

      if (!schoolRecordData) {
        // Fallback default record if masquerading or previewing
        const cachedName = sessionStorage.getItem('schoolName') || localStorage.getItem('jaystar_cached_school_name');
        schoolRecordData = {
          id: schoolId || 'school-default',
          name: effective.effectiveName || cachedName || 'Partner School Institution',
          plan: 'Institutional Partner Plan',
          coordinator: 'School Administrator',
          labDays: 'Mon - Fri'
        };
      }

      if (schoolRecordData.name && !['School Portal', 'school-default', 'Partner School Institution'].includes(schoolRecordData.name)) {
        sessionStorage.setItem('schoolName', schoolRecordData.name);
        localStorage.setItem('jaystar_cached_school_name', schoolRecordData.name);
      }

      setSchool(schoolRecordData);
      const activeSchoolId = schoolRecordData.id;

      let fetchedStudentCount = 0;
      try {
        if (!effective.isMasquerading) {
          const studentsResult = await jsonFetch<{ count: number; schoolName?: string }>('/.netlify/functions/school-students');
          fetchedStudentCount = Number(studentsResult.count || 0);
          if (studentsResult.schoolName && studentsResult.schoolName !== 'School Portal') {
            sessionStorage.setItem('schoolName', studentsResult.schoolName);
            setSchool(prev => prev ? { ...prev, name: studentsResult.schoolName } : prev);
          }
        } else {
          throw new Error('Impersonation mode using client-side Firestore query');
        }
      } catch {
        const [studSnap, indivSnap, allStudSnap, allIndivSnap] = await Promise.all([
          getDocs(query(collection(db, 'students'), where('schoolId', '==', activeSchoolId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, 'individualStudents'), where('schoolId', '==', activeSchoolId))).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'students')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'individualStudents')).catch(() => ({ docs: [] }))
        ]);

        const seenIds = new Set<string>();
        const targetLow = activeSchoolId.toLowerCase();
        const nameLow = (schoolRecordData.name || '').toLowerCase();
        const codeLow = ((schoolRecordData as any).schoolCode || '').toLowerCase();

        const checkDoc = (d: any) => {
          if (seenIds.has(d.id)) return;
          const data = d.data();
          const sIdField = String(data.schoolId || data.school_id || '').trim().toLowerCase();
          const sNameField = String(data.schoolName || data.school || data.institutionName || data.institution || '').trim().toLowerCase();
          const sCodeField = String(data.schoolCode || '').trim().toLowerCase();

          const isMatch = (
            (targetLow && (sIdField === targetLow || sIdField.includes(targetLow) || targetLow.includes(sIdField))) ||
            (nameLow && (sNameField === nameLow || sNameField.includes(nameLow) || nameLow.includes(sNameField) || sIdField === nameLow || sIdField.includes(nameLow))) ||
            (codeLow && (sCodeField === codeLow || sCodeField === targetLow || sIdField === codeLow))
          );

          if (isMatch) seenIds.add(d.id);
        };

        studSnap.docs.forEach(checkDoc);
        indivSnap.docs.forEach(checkDoc);
        allStudSnap.docs.forEach(checkDoc);
        allIndivSnap.docs.forEach(checkDoc);

        fetchedStudentCount = seenIds.size;
      }

      try {
        const scheduleResult = await jsonFetch<{ schedules: ClassSchedule[] }>('/.netlify/functions/class-schedules');
        if (Array.isArray(scheduleResult.schedules) && scheduleResult.schedules.length > 0) {
          setClassSchedules(scheduleResult.schedules);
        } else {
          throw new Error('Empty from server, try Firestore query');
        }
      } catch {
        const [schedSnap, nameSnap] = await Promise.all([
          getDocs(query(collection(db, 'classSchedules'), where('schoolId', '==', activeSchoolId))).catch(() => ({ docs: [] })),
          schoolRecordData.name ? getDocs(query(collection(db, 'classSchedules'), where('schoolName', '==', schoolRecordData.name))).catch(() => ({ docs: [] })) : Promise.resolve({ docs: [] })
        ]);
        const schedMap = new Map<string, ClassSchedule>();
        schedSnap.docs.forEach(d => schedMap.set(d.id, { id: d.id, ...d.data() } as ClassSchedule));
        nameSnap.docs.forEach(d => {
          if (!schedMap.has(d.id)) schedMap.set(d.id, { id: d.id, ...d.data() } as ClassSchedule);
        });
        setClassSchedules(Array.from(schedMap.values()));
      }

      const [examSnap, linkSnap, passSnap] = await Promise.all([
        getDocs(query(collection(db, 'schoolExams'), where('schoolId', '==', activeSchoolId))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'schoolLinks'), where('schoolId', '==', activeSchoolId))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'schoolPasscodes'), where('schoolId', '==', activeSchoolId))).catch(() => ({ docs: [] })),
      ]);
      setStudentCount(fetchedStudentCount);
      setExams(examSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Exam,'id'>) })));
      setLinks(linkSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SchoolLink,'id'>) })));
      setPasscodes(passSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Passcode,'id'>) })));
    } catch (error) {
      setSchool(null); setStudentCount(0); setExams([]); setLinks([]); setPasscodes([]); setClassSchedules([]);
      toast.error(error instanceof Error ? error.message : 'Unable to load school operations.');
    } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const filteredExams = useMemo(() => { const q = search.trim().toLowerCase(); return q ? exams.filter(e => [e.title,e.subject,e.term,e.targetClass].some(v => String(v || '').toLowerCase().includes(q))) : exams; }, [exams, search]);
  const filteredLinks = useMemo(() => { const q = search.trim().toLowerCase(); return q ? links.filter(l => [l.title,l.description,l.url].some(v => String(v || '').toLowerCase().includes(q))) : links; }, [links, search]);
  const openReader = (url: string, title: string) => { if (!url) return toast.error('No preview URL is available.'); setReader({ url, title }); setReaderLoading(true); };
  const generatePasscode = () => { const bytes = new Uint32Array(2); crypto.getRandomValues(bytes); return `EXAM-${String(bytes[0] % 1000).padStart(3,'0')}-${String(bytes[1] % 1000).padStart(3,'0')}`; };

  const savePasscode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passcodeForm?.examTitle?.trim() || !passcodeForm.passcode?.trim() || !school?.id) { toast.error('Exam title and passcode are required.'); return; }
    const id = passcodeForm.id || `pc-${Date.now()}`;
    const payload = { classLevel: passcodeForm.classLevel || 'General', subject: passcodeForm.subject || '', examTitle: passcodeForm.examTitle.trim(), passcode: passcodeForm.passcode.trim().toUpperCase(), isActive: passcodeForm.isActive !== false, validUntil: passcodeForm.validUntil || '', invigilatorName: passcodeForm.invigilatorName || '', allocatedCadetsCount: passcodeForm.allocatedCadetsCount || studentCount, schoolId: school.id, updatedAt: serverTimestamp() };
    try {
      await setDoc(doc(db, 'schoolPasscodes', id), payload, { merge: true });
      const next = { id, ...payload } as Passcode;
      setPasscodes(prev => prev.some(p => p.id === id) ? prev.map(p => p.id === id ? next : p) : [next, ...prev]);
      setPasscodeForm(null); toast.success('Exam passcode saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save passcode.'); }
  };
  const togglePasscode = async (passcode: Passcode) => {
    try { await setDoc(doc(db, 'schoolPasscodes', passcode.id), { isActive: !passcode.isActive, updatedAt: serverTimestamp() }, { merge: true }); setPasscodes(prev => prev.map(p => p.id === passcode.id ? { ...p, isActive: !p.isActive } : p)); toast.success(passcode.isActive ? 'Passcode deactivated.' : 'Passcode activated.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update passcode.'); }
  };

  if (loading) return <div className="min-h-[360px] flex items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="animate-spin" size={22}/> Loading secure school operations…</div>;
  const schoolName = school?.name || 'School Portal';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <SEO title={`School Operations | ${schoolName}`} description="Secure school operations workspace." noindex />

      {tab === 'overview' && (
        <div className="space-y-6">
          <DashboardGreeting
            name={schoolName.split(' ')[0] || schoolName}
            role="Partner Institution"
            subtitle="Manage student enrollment, exam passcodes, class schedules, and billing."
          />

          {/* Focused school overview: operational metrics and shortcuts only. Detailed programmes,
              schedules, roster, resources, exams and billing live in their dedicated tabs. */}
          {(() => {
            const programsList: any[] = Array.isArray(school?.programs) ? school.programs : [];
            const activeProgs = programsList.filter(p => p.status !== 'COMPLETED' && p.status !== 'HISTORICAL');
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="pro-surface rounded-2xl p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Students</p><p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{studentCount}</p><p className="text-[10px] text-slate-500 mt-0.5">Onboarded learners</p></div>
                  <div className="pro-surface rounded-2xl p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Active Programmes</p><p className="mt-1 text-2xl font-black text-brand-red">{activeProgs.length}</p><p className="text-[10px] text-slate-500 mt-0.5">Configured for this school</p></div>
                  <div className="pro-surface rounded-2xl p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Billing Status</p><p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{school?.billing?.status || 'Not configured'}</p><p className="text-[10px] text-slate-500 mt-0.5">Institutional account</p></div>
                </div>
                <section className="pro-surface rounded-3xl p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4 mb-4"><div><h2 className="text-base font-black text-slate-900 dark:text-white">School Operations</h2><p className="text-xs text-slate-500 mt-1">Open the dedicated workspace for the task you need to complete.</p></div><Building2 size={18} className="text-brand-red" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      ['roster','Student Roster','Manage learners and class groups',Users],
                      ['schedules','Class Schedules','View programmes, tutors and sessions',Calendar],
                      ['resources','Resources','Review school learning materials',BookOpen],
                      ['partnership','Programme & Billing','View institutional programme settings',CreditCard]
                    ].map(([id,title,description,Icon]: any) => <button key={id} type="button" onClick={() => changeTab(id)} className="text-left p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-brand-red/40 transition-all"><Icon className="text-brand-red mb-2" size={19}/><p className="text-xs font-black text-slate-900 dark:text-white">{title}</p><p className="text-[11px] text-slate-500 mt-1 leading-4">{description}</p></button>)}
                  </div>
                </section>
              </div>
            );
          })()}

      {tab === 'roster' && (
        <div className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Student Roster</h2>
          <p className="text-xs text-slate-500 mt-1">Roster management has moved to the secure student operations page. Student portal credentials are never exposed in this workspace.</p>
          <button onClick={() => navigate('/portal/school/roster')} className="mt-4 min-h-9 rounded-xl bg-brand-red text-white px-4 text-xs font-bold inline-flex items-center gap-2">
            <Users size={14}/> Open secure roster <ChevronRight size={14}/>
          </button>
        </div>
      )}

      {tab === 'exams' && (
        <div className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Award size={18} className="text-brand-red"/> CBT Assessments
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Only assessments belonging to your linked school are loaded.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, subject..." className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 pl-9 pr-3 text-xs bg-white dark:bg-slate-900"/>
            </div>
          </div>

          {filteredExams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
              No school assessments found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredExams.map(exam => {
                const url = exam.link || exam.url || exam.fileUrl || '';
                return (
                  <div key={exam.id} className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="flex justify-between items-center gap-2">
                      <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {exam.status || 'SCHEDULED'}
                      </span>
                      <span className="text-[11px] text-slate-500">{exam.duration || 'Duration not set'}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{exam.title}</h3>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div>Subject: {exam.subject || 'Coding & Tech'}</div>
                      <div>Class: {exam.targetClass || 'All eligible learners'}</div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {url && (
                        <button onClick={() => openReader(url, exam.title)} className="min-h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Eye size={13}/> Preview
                        </button>
                      )}
                      <a href={url || undefined} target="_blank" rel="noopener noreferrer" className="min-h-8 flex-1 rounded-lg bg-brand-red text-white px-3 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                        <ExternalLink size={13}/> Launch
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'passcodes' && (
        <div className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Key size={18} className="text-brand-red"/> Exam Passcodes
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Examination keys for CBT invigilation.</p>
            </div>
            <button onClick={() => setPasscodeForm({ classLevel: 'General', subject: 'Coding & Tech', examTitle: '', passcode: generatePasscode(), isActive: true, validUntil: 'End of Term' })} className="min-h-9 rounded-xl bg-brand-red text-white px-3 text-xs font-bold inline-flex items-center gap-1.5">
              <Key size={14}/> New passcode
            </button>
          </div>

          {passcodes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
              No exam passcodes configured.
            </div>
          ) : (
            <div className="space-y-2.5">
              {passcodes.map(pc => (
                <div key={pc.id} className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
                  <div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] uppercase font-bold rounded-md px-2 py-0.5 bg-slate-200 dark:bg-slate-800">{pc.classLevel}</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{pc.subject}</span>
                      <span className={`text-[10px] font-bold rounded-md px-2 py-0.5 ${pc.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'}`}>
                        {pc.isActive ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-1.5">{pc.examTitle}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Valid: {pc.validUntil || 'End of Term'} • Invigilator: {pc.invigilatorName || 'School'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-mono font-bold text-xs">{pc.passcode}</code>
                    <button onClick={() => { navigator.clipboard.writeText(pc.passcode); toast.success('Exam passcode copied.'); }} className="min-h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold inline-flex items-center gap-1">
                      <Copy size={12}/> Copy
                    </button>
                    <button onClick={() => void togglePasscode(pc)} className="min-h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold">
                      {pc.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'resources' && (
        <div id="school-resources-workspace" className="space-y-4">
          <ResourceLibrary role="school" />
        </div>
      )}

      {tab === 'links' && (
        <div id="school-links-section" className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Link2 size={18} className="text-brand-red"/> School Links & Educational Portals
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Quick access to institutional platforms, portals, and materials restricted to your school.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search links..." className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 pl-9 pr-3 text-xs bg-white dark:bg-slate-900"/>
            </div>
          </div>

          {filteredLinks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
              No school links found matching your search.
            </div>
          ) : (
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/40">
              {filteredLinks.map(link => (
                <div key={link.id} className="p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0">
                      <Link2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{link.title}</h3>
                      <p className="text-[11px] text-slate-500 truncate max-w-xl">{link.description || link.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button onClick={() => openReader(link.url, link.title)} className="min-h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <Eye size={12}/> Preview
                    </button>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="min-h-8 rounded-lg bg-brand-red text-white px-3 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-brand-red/90 transition-colors">
                      <ExternalLink size={12}/> Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'schedules' && (
        <SchoolClassScheduleTimeline
          schoolId={school?.id || ''}
          schoolName={schoolName}
          programs={school?.programs || []}
          schedules={classSchedules as any}
          onRefresh={() => void load()}
          readOnly={false}
        />
      )}

      {tab === 'partnership' && (
        <div className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <CreditCard size={18} className="text-brand-red"/> Institutional Subscription &amp; Fees
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Admin-configured institutional curriculum billing and payment schedule.</p>
            </div>
            {effective.isMasquerading ? (
              <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={14} />
                <span>Payment execution disabled during Impersonation Mode</span>
              </div>
            ) : (
              <button 
                onClick={() => navigate('/portal/school/payments')} 
                className="px-4 py-2 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors"
              >
                <CreditCard size={14}/> Complete Payment / Invoices
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-900 text-white p-5 border border-slate-800 space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Undergoing Curriculum Plan</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  school?.billing?.status === 'OVERDUE' 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                    : school?.billing?.status === 'DUE' 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {school?.billing?.status || 'ACTIVE SUBSCRIPTION'}
                </span>
              </div>
              <h3 className="text-lg font-black text-white">{school?.plan || 'Standard Technology Curriculum'}</h3>
              <p className="text-xs text-slate-300">
                Covers hands-on computer science lab instructions, STEM curriculum kits, and learner CBT assessment portals.
              </p>
              {school?.billing?.notes && (
                <div className="text-[11px] text-slate-400 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700 mt-2">
                  <strong className="text-slate-300">Administrative Note:</strong> {school.billing.notes}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Institutional Fee</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {school?.billing?.baseAmount ? formatNaira(school.billing.baseAmount) : 'Custom Fee'}
              </div>
              <div className="text-xs text-slate-500 space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between">
                  <span>Cycle:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{school?.billing?.cycle || 'Termly'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mode:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">
                    {school?.billing?.mode ? school.billing.mode.replace(/_/g, ' ') : 'Advance Termly'}
                  </span>
                </div>
                {school?.billing?.nextDueDate && (
                  <div className="flex justify-between">
                    <span>Due Date:</span>
                    <span className="font-bold text-brand-red">
                      {new Date(school.billing.nextDueDate).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {passcodeForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <form onSubmit={savePasscode} className="w-full max-w-md rounded-2xl bg-white dark:bg-[#161B26] p-5 space-y-3.5 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create Exam Passcode</h3>
              <button type="button" onClick={() => setPasscodeForm(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
            </div>
            <input required value={passcodeForm.examTitle||''} onChange={e=>setPasscodeForm(p=>({...p,examTitle:e.target.value}))} placeholder="Assessment title" className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-xs bg-white dark:bg-slate-900"/>
            <input required value={passcodeForm.passcode||''} onChange={e=>setPasscodeForm(p=>({...p,passcode:e.target.value.toUpperCase()}))} placeholder="EXAM-123-456" className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-xs font-mono bg-white dark:bg-slate-900"/>
            <div className="grid grid-cols-2 gap-2.5">
              <input value={passcodeForm.classLevel||''} onChange={e=>setPasscodeForm(p=>({...p,classLevel:e.target.value}))} placeholder="Class level" className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-xs bg-white dark:bg-slate-900"/>
              <input value={passcodeForm.subject||''} onChange={e=>setPasscodeForm(p=>({...p,subject:e.target.value}))} placeholder="Subject" className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-xs bg-white dark:bg-slate-900"/>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPasscodeForm(null)} className="min-h-9 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300">Cancel</button>
              <button type="submit" className="min-h-9 rounded-xl bg-brand-red text-white px-4 text-xs font-bold">Save Passcode</button>
            </div>
          </form>
        </div>
      )}

      {reader && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 p-3 md:p-6 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setReader(null); }}>
          <div className="w-full max-w-5xl h-[88vh] rounded-2xl bg-white dark:bg-[#161B26] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
              <div className="min-w-0">
                <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate">{reader.title}</h3>
                <p className="text-[10px] text-slate-500">Secure school document preview</p>
              </div>
              <div className="flex gap-2">
                <a href={reader.url} target="_blank" rel="noopener noreferrer" className="min-h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <ExternalLink size={12}/> Open
                </a>
                <button onClick={() => setReader(null)} className="min-h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-slate-600 dark:text-slate-300"><X size={14}/></button>
              </div>
            </div>
            <div className="relative flex-1 bg-slate-950">
              {readerLoading && <div className="absolute inset-0 z-10 flex items-center justify-center text-white text-xs"><Loader2 className="animate-spin mr-2" size={18}/> Loading document...</div>}
              <iframe src={getEmbeddableUrl(reader.url)} title={reader.title} className="w-full h-full border-0 bg-white" onLoad={() => setReaderLoading(false)}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SchoolDashboard;
