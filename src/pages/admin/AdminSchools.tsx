import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { billingPost } from '../../lib/billing';
import { useToast } from '../../contexts/ToastContext';
import { School, Key, BookOpen, Plus, Trash2, ExternalLink, Lock, FileText, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';

const AFFILIATED_SCHOOLS = [
  { id: 'peniel', name: 'Peniel Lily Montessori School', icon: '🎓' },
  { id: 'southgold', name: 'South Gold Montessori School', icon: '🏆' },
  { id: 'sapphire', name: 'Sapphire Explorer Montessori School', icon: '💎' },
  { id: 'easystars', name: 'Easy Stars Early Years Academy', icon: '⭐' },
  { id: 'christycaleb', name: 'Christy Caleb International School', icon: '📚' },
  { id: 'royalbreed', name: 'Royal Breed Academy', icon: '👑' },
];

const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red';

const AdminSchools: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'accessCodes' | 'schoolResources' | 'schoolExams'>('accessCodes');
  const [loading, setLoading] = useState(true);
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState('all');
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [issuedCodes, setIssuedCodes] = useState<Record<string, string>>({});
  const [schoolResources, setSchoolResources] = useState<any[]>([]);
  const [schoolExams, setSchoolExams] = useState<any[]>([]);
  const [resForm, setResForm] = useState({ schoolId: 'peniel', type: 'resource', title: '', url: '', description: '' });
  const [examForm, setExamForm] = useState({ schoolId: 'peniel', title: '', url: '', description: '' });
  const [resSubmitting, setResSubmitting] = useState(false);
  const [examSubmitting, setExamSubmitting] = useState(false);

  const getSchoolName = (id: string) => AFFILIATED_SCHOOLS.find(item => item.id === id)?.name || id;

  const fetchSchoolData = useCallback(async () => {
    setLoading(true);
    try {
      const [rSnap, lSnap, eSnap] = await Promise.all([
        getDocs(query(collection(db, 'schoolResources'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'schoolResources'))),
        getDocs(query(collection(db, 'schoolLinks'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'schoolLinks'))),
        getDocs(query(collection(db, 'schoolExams'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'schoolExams'))),
      ]);
      const merged: any[] = [];
      rSnap.forEach(d => merged.push({ id: d.id, collectionName: 'schoolResources', kind: 'resource', ...d.data() }));
      lSnap.forEach(d => merged.push({ id: d.id, collectionName: 'schoolLinks', kind: 'link', ...d.data() }));
      merged.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
      setSchoolResources(merged);
      setSchoolExams(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching school data:', error);
      toast.error('Failed to load affiliated schools data.');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { void fetchSchoolData(); }, [fetchSchoolData]);

  const rotateAccessCode = async (schoolId: string) => {
    const requested = String(codeInputs[schoolId] || '').trim().toUpperCase();
    if (requested && (requested.length < 8 || requested.length > 40 || !/^[A-Z0-9_-]+$/.test(requested))) {
      toast.error('Use 8–40 letters, numbers, hyphens or underscores.');
      return;
    }
    setRotatingId(schoolId);
    try {
      const result = await billingPost<any>('admin-school-access-code', { schoolId, accessCode: requested || undefined });
      setIssuedCodes(prev => ({ ...prev, [schoolId]: result.credentials.accessCode }));
      setCodeInputs(prev => ({ ...prev, [schoolId]: '' }));
      toast.success(`New secure access code issued for ${getSchoolName(schoolId)}. Save it now; it will not be shown again.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to rotate school access code.');
    } finally { setRotatingId(null); }
  };

  const handlePostSchoolResource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resForm.title.trim() || !resForm.url.trim()) { toast.error('Please enter a title and file/link URL.'); return; }
    setResSubmitting(true);
    const collectionName = resForm.type === 'link' ? 'schoolLinks' : 'schoolResources';
    const urlKey = resForm.type === 'link' ? 'url' : 'fileUrl';
    try {
      await addDoc(collection(db, collectionName), { schoolId: resForm.schoolId, title: resForm.title.trim(), [urlKey]: resForm.url.trim(), description: resForm.description.trim(), timestamp: serverTimestamp() });
      toast.success(`Dispatched ${resForm.type} to ${getSchoolName(resForm.schoolId)}.`);
      setResForm({ schoolId: resForm.schoolId, type: 'resource', title: '', url: '', description: '' });
      void fetchSchoolData();
    } catch (error: any) { toast.error(`Error: ${error.message}`); } finally { setResSubmitting(false); }
  };

  const handlePostSchoolExam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!examForm.title.trim() || !examForm.url.trim()) { toast.error('Please enter an exam title and link.'); return; }
    setExamSubmitting(true);
    try {
      await addDoc(collection(db, 'schoolExams'), { schoolId: examForm.schoolId, title: examForm.title.trim(), url: examForm.url.trim(), description: examForm.description.trim(), timestamp: serverTimestamp() });
      toast.success(`School exam published for ${getSchoolName(examForm.schoolId)}.`);
      setExamForm({ schoolId: examForm.schoolId, title: '', url: '', description: '' });
      void fetchSchoolData();
    } catch (error: any) { toast.error(`Error: ${error.message}`); } finally { setExamSubmitting(false); }
  };

  const handleDeleteItem = async (id: string, collectionName: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try { await deleteDoc(doc(db, collectionName, id)); toast.success(`Deleted "${title}".`); void fetchSchoolData(); }
    catch (error: any) { toast.error(`Failed to delete item: ${error.message}`); }
  };

  const filteredResources = schoolResources.filter(item => selectedSchoolFilter === 'all' || item.schoolId === selectedSchoolFilter);
  const filteredExams = schoolExams.filter(item => selectedSchoolFilter === 'all' || item.schoolId === selectedSchoolFilter);

  return <div className="space-y-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-black text-brand-slate dark:text-white"><School className="h-8 w-8 text-brand-red" />Affiliated Schools Command</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage institutional credentials, resources and assessments for partner schools.</p>
      </div>
      <div className="flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filter</span><select value={selectedSchoolFilter} onChange={e => setSelectedSchoolFilter(e.target.value)} className={inputClass + ' w-auto min-w-[220px]'}><option value="all">All 6 Affiliated Schools</option>{AFFILIATED_SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
    </div>

    <div className="flex gap-4 overflow-x-auto border-b border-gray-200 dark:border-slate-800" role="tablist" aria-label="School management sections">
      {[['accessCodes', Lock, 'School Credentials'], ['schoolResources', BookOpen, `Resources & Links (${schoolResources.length})`], ['schoolExams', FileText, `Exams (${schoolExams.length})`]].map(([key, Icon, label]) => <button key={String(key)} type="button" role="tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key as any)} className={`flex shrink-0 items-center gap-2 border-b-2 px-2 pb-3 text-sm font-bold ${activeTab === key ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}><Icon size={17}/>{label as string}</button>)}
    </div>

    {activeTab === 'accessCodes' && <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300"><ShieldCheck size={18} className="mt-0.5 shrink-0"/><div><strong>Credentials are now protected.</strong> School access codes are stored as hashes. Existing legacy codes are migrated when you rotate them. The new code is displayed only once after issuance.</div></div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{AFFILIATED_SCHOOLS.map(school => { const issued = issuedCodes[school.id]; const rotating = rotatingId === school.id; return <article key={school.id} className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div><div className="mb-4 flex items-center gap-3"><span className="text-2xl">{school.icon}</span><div><h3 className="text-sm font-extrabold leading-snug text-gray-900 dark:text-white">{school.name}</h3><span className="font-mono text-[11px] text-gray-400">ID: {school.id}</span></div></div><div className="rounded-xl border border-gray-100 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-800/60"><div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400"><Lock size={12}/> Stored securely</div><div className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">Active code is never displayed here.</div>{issued && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30"><div className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">New code — save now</div><div className="mt-1 break-all font-mono text-sm font-black tracking-wider text-brand-red">{issued}</div></div>}</div></div>
        <div className="mt-5 space-y-2 border-t border-gray-100 pt-4 dark:border-slate-800"><label className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Custom code (optional)</label><div className="flex gap-2"><input value={codeInputs[school.id] || ''} onChange={e => setCodeInputs(prev => ({ ...prev, [school.id]: e.target.value.toUpperCase() }))} placeholder="Leave blank to generate" className={inputClass + ' font-mono text-xs'}/><button type="button" disabled={rotating} onClick={() => void rotateAccessCode(school.id)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-slate px-3 text-xs font-bold text-white disabled:opacity-50">{rotating ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}Rotate</button></div></div>
      </article>; })}</div>
    </div>}

    {activeTab === 'schoolResources' && <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-2 flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white"><Plus size={18} className="text-brand-red"/>Deploy School Resource</h2><p className="mb-5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">Publish files, guides or links restricted to a selected partner school.</p><form onSubmit={handlePostSchoolResource} className="space-y-4"><select value={resForm.schoolId} onChange={e => setResForm({...resForm, schoolId: e.target.value})} className={inputClass}>{AFFILIATED_SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={resForm.type} onChange={e => setResForm({...resForm, type: e.target.value})} className={inputClass}><option value="resource">File / Document</option><option value="link">Platform Link</option></select><input required value={resForm.title} onChange={e => setResForm({...resForm, title: e.target.value})} placeholder="Resource title" className={inputClass}/><input required type="url" value={resForm.url} onChange={e => setResForm({...resForm, url: e.target.value})} placeholder="https://..." className={inputClass}/><textarea rows={3} value={resForm.description} onChange={e => setResForm({...resForm, description: e.target.value})} placeholder="Instructions or description" className={inputClass}/><button disabled={resSubmitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-bold text-white disabled:opacity-50">{resSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}Dispatch to School</button></form></div>
      <div className="space-y-4 lg:col-span-2"><h2 className="text-lg font-black text-gray-900 dark:text-white">School Resources & Materials ({filteredResources.length})</h2>{loading ? <div className="py-12 text-center text-sm text-gray-400">Loading materials…</div> : filteredResources.length === 0 ? <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-slate-800 dark:bg-slate-900">No materials found for the selected school.</div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{filteredResources.map(item => <article key={item.id} className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div><div className="mb-2 flex items-center justify-between gap-2"><span className="max-w-[190px] truncate rounded bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">{getSchoolName(item.schoolId)}</span><button type="button" onClick={() => void handleDeleteItem(item.id, item.collectionName, item.title)} className="p-1 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={16}/></button></div><h3 className="mb-1 text-base font-black text-gray-900 dark:text-white">{item.title}</h3><p className="mb-4 line-clamp-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{item.description || 'No description provided.'}</p></div><div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-slate-800"><a href={item.url || item.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"><ExternalLink size={14}/>Open Material</a><span className="text-[11px] font-mono text-gray-400">{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : 'Active'}</span></div></article>)}</div>}</div>
    </div>}

    {activeTab === 'schoolExams' && <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-2 flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white"><Plus size={18} className="text-brand-red"/>Deploy School Exam</h2><p className="mb-5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">Publish school-specific term assessments and coding practicals.</p><form onSubmit={handlePostSchoolExam} className="space-y-4"><select value={examForm.schoolId} onChange={e => setExamForm({...examForm, schoolId: e.target.value})} className={inputClass}>{AFFILIATED_SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><input required value={examForm.title} onChange={e => setExamForm({...examForm, title: e.target.value})} placeholder="Exam title" className={inputClass}/><input required type="url" value={examForm.url} onChange={e => setExamForm({...examForm, url: e.target.value})} placeholder="https://forms.google.com/..." className={inputClass}/><textarea rows={3} value={examForm.description} onChange={e => setExamForm({...examForm, description: e.target.value})} placeholder="Instructions and guidelines" className={inputClass}/><button disabled={examSubmitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-bold text-white disabled:opacity-50">{examSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}Deploy School Exam</button></form></div>
      <div className="space-y-4 lg:col-span-2"><h2 className="text-lg font-black text-gray-900 dark:text-white">Active School Exams ({filteredExams.length})</h2>{loading ? <div className="py-12 text-center text-sm text-gray-400">Loading exams…</div> : filteredExams.length === 0 ? <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-slate-800 dark:bg-slate-900">No exams found for the selected school.</div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{filteredExams.map(item => <article key={item.id} className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div><div className="mb-2 flex items-center justify-between gap-2"><span className="max-w-[190px] truncate rounded bg-brand-red/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-brand-red">{getSchoolName(item.schoolId)}</span><button type="button" onClick={() => void handleDeleteItem(item.id, 'schoolExams', item.title)} className="p-1 text-gray-400 hover:text-red-500" title="Delete exam"><Trash2 size={16}/></button></div><h3 className="mb-1 text-base font-black text-gray-900 dark:text-white">{item.title}</h3><p className="mb-4 line-clamp-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{item.description || 'Instructions provided within the examination link.'}</p></div><div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-slate-800"><a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"><ExternalLink size={14}/>Open Examination</a><span className="text-[11px] font-mono text-gray-400">{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : 'Active'}</span></div></article>)}</div>}</div>
    </div>}
  </div>;
};

export default AdminSchools;
