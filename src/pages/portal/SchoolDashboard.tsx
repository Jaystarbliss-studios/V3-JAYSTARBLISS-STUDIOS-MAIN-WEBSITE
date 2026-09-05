import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Award, BookOpen, Calendar, ChevronRight, Copy, CreditCard, ExternalLink, Eye, Key, Link2, Loader2, RefreshCw, Search, Users, X } from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { auth, db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

export type SchoolDashboardTab = 'overview' | 'roster' | 'exams' | 'passcodes' | 'resources' | 'links' | 'schedules' | 'partnership';
export interface SchoolDashboardProps { initialTab?: SchoolDashboardTab; }

type SchoolRecord = { id: string; name?: string; plan?: string; coordinator?: string; labDays?: string; };
type Passcode = { id: string; classLevel: string; subject?: string; examTitle: string; passcode: string; isActive: boolean; validUntil?: string; invigilatorName?: string; allocatedCadetsCount?: number; };
type Exam = { id: string; title: string; subject?: string; term?: string; duration?: string; link?: string; url?: string; fileUrl?: string; status?: string; date?: string; targetClass?: string; description?: string; passcodeProtected?: boolean; };
type SchoolLink = { id: string; title: string; url: string; description?: string; };

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
  const [tab, setTab] = useState<SchoolDashboardTab>(initialTab || 'overview');
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [passcodes, setPasscodes] = useState<Passcode[]>([]);
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

  const changeTab = (next: SchoolDashboardTab) => {
    setTab(next);
    navigate(next === 'overview' ? '/portal/school' : `/portal/school/${next}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Authentication required.');
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userSnap.exists()) throw new Error('School profile not found.');
      const userData = userSnap.data();
      if (String(userData.role || '').toLowerCase() !== 'school') throw new Error('Only school accounts can access this workspace.');
      const schoolId = String(userData.schoolId || '').trim();
      if (!schoolId) throw new Error('Your school account is not linked to a school.');
      const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
      if (!schoolSnap.exists()) throw new Error('Linked school record not found.');
      setSchool({ id: schoolSnap.id, ...(schoolSnap.data() as SchoolRecord) });

      const [studentsResult, examSnap, linkSnap, passSnap] = await Promise.all([
        jsonFetch<{ count: number }>('/.netlify/functions/school-students'),
        getDocs(query(collection(db, 'schoolExams'), where('schoolId', '==', schoolId))),
        getDocs(query(collection(db, 'schoolLinks'), where('schoolId', '==', schoolId))),
        getDocs(query(collection(db, 'schoolPasscodes'), where('schoolId', '==', schoolId))),
      ]);
      setStudentCount(Number(studentsResult.count || 0));
      setExams(examSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Exam,'id'>) })));
      setLinks(linkSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SchoolLink,'id'>) })));
      setPasscodes(passSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Passcode,'id'>) })));
    } catch (error) {
      setSchool(null); setStudentCount(0); setExams([]); setLinks([]); setPasscodes([]);
      toast.error(error instanceof Error ? error.message : 'Unable to load school operations.');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const filteredExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter(e => [e.title,e.subject,e.term,e.targetClass].some(v => String(v || '').toLowerCase().includes(q)));
  }, [exams, search]);
  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(l => [l.title,l.description,l.url].some(v => String(v || '').toLowerCase().includes(q)));
  }, [links, search]);

  const openReader = (url: string, title: string) => {
    if (!url) return toast.error('No preview URL is available.');
    setReader({ url, title }); setReaderLoading(true);
  };

  const generatePasscode = () => {
    const bytes = new Uint32Array(2);
    crypto.getRandomValues(bytes);
    return `EXAM-${String(bytes[0] % 1000).padStart(3,'0')}-${String(bytes[1] % 1000).padStart(3,'0')}`;
  };

  const savePasscode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passcodeForm?.examTitle?.trim() || !passcodeForm.passcode?.trim() || !school?.id) {
      toast.error('Exam title and passcode are required.'); return;
    }
    const id = passcodeForm.id || `pc-${Date.now()}`;
    const payload = {
      classLevel: passcodeForm.classLevel || 'General',
      subject: passcodeForm.subject || 'STEM & Coding',
      examTitle: passcodeForm.examTitle.trim(),
      passcode: passcodeForm.passcode.trim().toUpperCase(),
      isActive: passcodeForm.isActive !== false,
      validUntil: passcodeForm.validUntil || 'End of Term',
      invigilatorName: passcodeForm.invigilatorName || 'School Invigilator',
      allocatedCadetsCount: passcodeForm.allocatedCadetsCount || studentCount,
      schoolId: school.id,
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'schoolPasscodes', id), payload, { merge: true });
      const next = { id, ...payload } as Passcode;
      setPasscodes(prev => prev.some(p => p.id === id) ? prev.map(p => p.id === id ? next : p) : [next, ...prev]);
      setPasscodeForm(null);
      toast.success('Exam passcode saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save passcode.'); }
  };

  const togglePasscode = async (passcode: Passcode) => {
    try {
      await setDoc(doc(db, 'schoolPasscodes', passcode.id), { isActive: !passcode.isActive, updatedAt: serverTimestamp() }, { merge: true });
      setPasscodes(prev => prev.map(p => p.id === passcode.id ? { ...p, isActive: !p.isActive } : p));
      toast.success(passcode.isActive ? 'Passcode deactivated.' : 'Passcode activated.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update passcode.'); }
  };

  if (loading) return <div className="min-h-[360px] flex items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="animate-spin" size={22}/> Loading secure school operations…</div>;

  const schoolName = school?.name || 'School Portal';
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <SEO title={`School Operations | ${schoolName}`} description="Secure school operations workspace." noindex />
      <div className="pro-surface rounded-3xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><div className="text-xs uppercase tracking-widest font-black text-brand-red">School Operations</div><h1 className="text-2xl md:text-3xl font-black mt-1">{schoolName}</h1><p className="text-sm text-slate-500 mt-2">Manage assessments, invigilator passcodes, school links and institutional operations without exposing student portal credentials.</p></div>
          <button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-black inline-flex items-center gap-2"><RefreshCw size={15}/> Refresh</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          {(['overview','roster','exams','passcodes','resources','links','schedules','partnership'] as SchoolDashboardTab[]).map(item => <button key={item} type="button" onClick={() => changeTab(item)} className={`min-h-10 rounded-xl px-3 text-xs font-black ${tab === item ? 'bg-brand-red text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>{item[0].toUpperCase()+item.slice(1)}</button>)}
        </div>
      </div>

      {tab === 'overview' && <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="pro-surface rounded-3xl p-6"><Users className="text-brand-red" size={20}/><div className="text-3xl font-black mt-3">{studentCount}</div><div className="text-xs text-slate-500 mt-1">Learners linked to this school</div></div>
        <div className="pro-surface rounded-3xl p-6"><Award className="text-brand-red" size={20}/><div className="text-3xl font-black mt-3">{exams.length}</div><div className="text-xs text-slate-500 mt-1">School assessments</div></div>
        <div className="pro-surface rounded-3xl p-6"><Key className="text-brand-red" size={20}/><div className="text-3xl font-black mt-3">{passcodes.filter(p=>p.isActive).length}</div><div className="text-xs text-slate-500 mt-1">Active exam passcodes</div></div>
        <div className="pro-surface rounded-3xl p-6 md:col-span-2"><h2 className="font-black">Quick actions</h2><div className="flex flex-wrap gap-2 mt-4"><button onClick={()=>changeTab('roster')} className="min-h-11 rounded-xl bg-brand-red text-white px-4 text-xs font-black inline-flex items-center gap-2"><Users size={15}/> View roster</button><button onClick={()=>changeTab('passcodes')} className="min-h-11 rounded-xl border px-4 text-xs font-black inline-flex items-center gap-2"><Key size={15}/> Manage passcodes</button><button onClick={()=>changeTab('exams')} className="min-h-11 rounded-xl border px-4 text-xs font-black inline-flex items-center gap-2"><Award size={15}/> Assessments</button></div></div>
        <div className="pro-surface rounded-3xl p-6"><h2 className="font-black">Institution</h2><p className="text-sm text-slate-500 mt-2">{school?.plan || 'No plan recorded'}</p><p className="text-xs text-slate-500 mt-3">Coordinator: {school?.coordinator || 'Not assigned'}</p><p className="text-xs text-slate-500 mt-1">Lab schedule: {school?.labDays || 'Not scheduled'}</p></div>
      </div>}

      {tab === 'roster' && <div className="pro-surface rounded-3xl p-6"><h2 className="text-xl font-black">Student roster</h2><p className="text-sm text-slate-500 mt-2">Roster management has moved to the secure student operations page. Student portal credentials are never exposed in this workspace.</p><button onClick={()=>navigate('/portal/school/roster')} className="mt-5 min-h-11 rounded-xl bg-brand-red text-white px-4 text-xs font-black inline-flex items-center gap-2"><Users size={15}/> Open secure roster <ChevronRight size={15}/></button></div>}

      {tab === 'exams' && <div className="pro-surface rounded-3xl p-6 md:p-8 space-y-5">
        <div><h2 className="text-xl font-black flex items-center gap-2"><Award size={20} className="text-brand-red"/> CBT assessments</h2><p className="text-sm text-slate-500 mt-1">Only assessments belonging to your linked school are loaded.</p></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, subject or class" className="w-full min-h-11 rounded-xl border pl-10 pr-3 text-sm bg-white dark:bg-slate-900"/></div>
        {filteredExams.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">No school assessments found.</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filteredExams.map(exam => { const url=exam.link||exam.url||exam.fileUrl||''; return <div key={exam.id} className="rounded-2xl border p-5 space-y-4"><div className="flex justify-between gap-3"><span className="rounded-full px-2.5 py-1 text-[10px] font-black bg-slate-100 dark:bg-slate-800">{exam.status||'SCHEDULED'}</span><span className="text-xs text-slate-500">{exam.duration||'Duration not set'}</span></div><h3 className="font-black">{exam.title}</h3><div className="text-xs text-slate-500 space-y-1"><div>Subject: {exam.subject||'Not set'}</div><div>Class: {exam.targetClass||'All eligible learners'}</div><div>Term: {exam.term||'Not set'}</div></div><div className="flex gap-2">{url&&<button onClick={()=>openReader(url,exam.title)} className="min-h-10 rounded-xl border px-3 text-xs font-black inline-flex items-center gap-2"><Eye size={14}/> Preview</button>}<a href={url||undefined} target="_blank" rel="noopener noreferrer" className="min-h-10 flex-1 rounded-xl bg-brand-red text-white px-3 text-xs font-black inline-flex items-center justify-center gap-2"><ExternalLink size={14}/> Launch</a></div></div>})}</div>}
      </div>}

      {tab === 'passcodes' && <div className="pro-surface rounded-3xl p-6 md:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h2 className="text-xl font-black flex items-center gap-2"><Key size={20} className="text-brand-red"/> Exam passcodes</h2><p className="text-sm text-slate-500 mt-1">These are examination/invigilator keys, not student portal credentials.</p></div><button onClick={()=>setPasscodeForm({classLevel:'General',subject:'STEM & Coding',examTitle:'',passcode:generatePasscode(),isActive:true,validUntil:'End of Term'})} className="min-h-11 rounded-xl bg-brand-red text-white px-4 text-xs font-black inline-flex items-center gap-2"><Key size={15}/> New passcode</button></div>
        {passcodes.length===0?<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">No exam passcodes configured.</div>:<div className="space-y-3">{passcodes.map(pc=><div key={pc.id} className="rounded-2xl border p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><div className="flex flex-wrap gap-2 items-center"><span className="text-[10px] uppercase font-black rounded-full px-2.5 py-1 bg-slate-100 dark:bg-slate-800">{pc.classLevel}</span><span className="text-xs font-bold">{pc.subject}</span><span className={`text-[10px] font-black rounded-full px-2.5 py-1 ${pc.isActive?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{pc.isActive?'ACTIVE':'DISABLED'}</span></div><h3 className="font-black mt-2">{pc.examTitle}</h3><p className="text-xs text-slate-500 mt-1">Valid: {pc.validUntil||'Not set'} · Invigilator: {pc.invigilatorName||'School'}</p></div><div className="flex items-center gap-2"><code className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 font-mono font-black text-sm">{pc.passcode}</code><button onClick={()=>{navigator.clipboard.writeText(pc.passcode);toast.success('Exam passcode copied.');}} className="min-h-10 rounded-xl border px-3 text-xs font-black inline-flex items-center gap-2"><Copy size={14}/> Copy</button><button onClick={()=>void togglePasscode(pc)} className="min-h-10 rounded-xl border px-3 text-xs font-black">{pc.isActive?'Deactivate':'Activate'}</button></div></div>)}</div>}
      </div>}

      {tab === 'resources' && <div className="pro-surface rounded-3xl p-6 md:p-8"><h2 className="text-xl font-black flex items-center gap-2"><BookOpen size={20} className="text-brand-red"/> School resources</h2><p className="text-sm text-slate-500 mt-2">Resource management and access-controlled delivery are handled in the shared Resource Library.</p><button onClick={()=>navigate('/portal/school/resources')} className="mt-5 min-h-11 rounded-xl bg-brand-red text-white px-4 text-xs font-black inline-flex items-center gap-2"><BookOpen size={15}/> Open Resource Library</button></div>}

      {tab === 'links' && <div className="pro-surface rounded-3xl p-6 md:p-8 space-y-5"><div><h2 className="text-xl font-black flex items-center gap-2"><Link2 size={20} className="text-brand-red"/> School links</h2><p className="text-sm text-slate-500 mt-1">Links are restricted to your school record.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search school links" className="w-full min-h-11 rounded-xl border pl-10 pr-3 text-sm bg-white dark:bg-slate-900"/></div>{filteredLinks.length===0?<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">No school links found.</div>:<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredLinks.map(link=><div key={link.id} className="rounded-2xl border p-5 flex flex-col gap-4"><div><h3 className="font-black">{link.title}</h3><p className="text-xs text-slate-500 mt-1">{link.description||'Institutional resource link'}</p></div><div className="flex gap-2 mt-auto"><button onClick={()=>openReader(link.url,link.title)} className="min-h-10 rounded-xl border px-3 text-xs font-black inline-flex items-center gap-2"><Eye size={14}/> Preview</button><a href={link.url} target="_blank" rel="noopener noreferrer" className="min-h-10 flex-1 rounded-xl bg-brand-red text-white px-3 text-xs font-black inline-flex items-center justify-center gap-2"><ExternalLink size={14}/> Open</a></div></div>)}</div>}</div>}

      {tab === 'schedules' && <div className="pro-surface rounded-3xl p-6 md:p-8"><h2 className="text-xl font-black flex items-center gap-2"><Calendar size={20} className="text-brand-red"/> Lab schedule</h2><p className="text-sm text-slate-500 mt-2">{school?.labDays || 'No schedule is recorded for this school yet.'}</p><div className="mt-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-5 text-sm"><strong>Coordinator:</strong> {school?.coordinator || 'Not assigned'}<br/><span className="text-slate-500">Schedule changes should be recorded by the school/admin operations team.</span></div></div>}

      {tab === 'partnership' && <div className="pro-surface rounded-3xl p-6 md:p-8"><h2 className="text-xl font-black flex items-center gap-2"><CreditCard size={20} className="text-brand-red"/> Institutional partnership</h2><div className="mt-5 rounded-2xl bg-slate-900 text-white p-6"><div className="text-[10px] uppercase tracking-widest font-black text-slate-300">Current plan</div><h3 className="text-2xl font-black mt-2">{school?.plan || 'No plan recorded'}</h3><p className="text-sm text-slate-300 mt-2">Billing, receipts and payment history are available from the School Billing tab.</p><button onClick={()=>navigate('/portal/school/payments')} className="mt-5 min-h-11 rounded-xl bg-white text-slate-900 px-4 text-xs font-black inline-flex items-center gap-2"><CreditCard size={15}/> Open billing</button></div></div>}

      {passcodeForm && <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"><form onSubmit={savePasscode} className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4"><div className="flex justify-between items-center"><h3 className="font-black text-lg">Create exam passcode</h3><button type="button" onClick={()=>setPasscodeForm(null)}><X size={18}/></button></div><input required value={passcodeForm.examTitle||''} onChange={e=>setPasscodeForm(p=>({...p,examTitle:e.target.value}))} placeholder="Assessment title" className="w-full min-h-11 rounded-xl border px-3 text-sm"/><input required value={passcodeForm.passcode||''} onChange={e=>setPasscodeForm(p=>({...p,passcode:e.target.value.toUpperCase()}))} placeholder="EXAM-123-456" className="w-full min-h-11 rounded-xl border px-3 text-sm font-mono"/><div className="grid grid-cols-2 gap-3"><input value={passcodeForm.classLevel||''} onChange={e=>setPasscodeForm(p=>({...p,classLevel:e.target.value}))} placeholder="Class level" className="w-full min-h-11 rounded-xl border px-3 text-sm"/><input value={passcodeForm.subject||''} onChange={e=>setPasscodeForm(p=>({...p,subject:e.target.value}))} placeholder="Subject" className="w-full min-h-11 rounded-xl border px-3 text-sm"/></div><div className="flex justify-end gap-2 pt-3"><button type="button" onClick={()=>setPasscodeForm(null)} className="min-h-11 rounded-xl border px-4 text-xs font-black">Cancel</button><button type="submit" className="min-h-11 rounded-xl bg-brand-red text-white px-4 text-xs font-black">Save passcode</button></div></form></div>}

      {reader && <div className="fixed inset-0 z-50 bg-slate-950/80 p-3 md:p-6 flex items-center justify-center" onClick={e=>{if(e.target===e.currentTarget)setReader(null)}}><div className="w-full max-w-6xl h-[92vh] rounded-3xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col"><div className="p-4 border-b flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="font-black truncate">{reader.title}</h3><p className="text-xs text-slate-500">Secure school document preview</p></div><div className="flex gap-2"><a href={reader.url} target="_blank" rel="noopener noreferrer" className="min-h-10 rounded-xl border px-3 text-xs font-black inline-flex items-center gap-2"><ExternalLink size={14}/> Open</a><button onClick={()=>setReader(null)} className="min-h-10 rounded-xl border px-3"><X size={16}/></button></div></div><div className="relative flex-1 bg-slate-950">{readerLoading&&<div className="absolute inset-0 z-10 flex items-center justify-center text-white"><Loader2 className="animate-spin" size={24}/></div>}<iframe src={getEmbeddableUrl(reader.url)} title={reader.title} className="w-full h-full border-0 bg-white" onLoad={()=>setReaderLoading(false)}/></div></div></div>}
    </div>
  );
};
export default SchoolDashboard;
