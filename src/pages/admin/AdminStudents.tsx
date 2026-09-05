import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, query, where, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { Users, UserPlus, Search, KeyRound, Copy, CheckCircle2, Trash2, Send, RefreshCw, ShieldCheck, X } from 'lucide-react';

interface Student { id: string; fullName?: string; username?: string; email?: string; class?: string; grade?: string; track?: string; subjects?: string[] | string; schoolId?: string; schoolName?: string; parentId?: string; accountStatus?: string; status?: string; }
interface Dispatch { id: string; collectionName: string; kind: 'resource' | 'link'; studentId?: string; title?: string; description?: string; url?: string; fileUrl?: string; timestamp?: any; }
interface Credentials { username: string; accessCode: string; portal: string; fullName: string; }

const ADMIN_ROLES = ['admin', 'super_admin', 'content_admin', 'education_admin', 'services_admin', 'marketing_admin', 'support_admin'];

const AdminStudents: React.FC = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [form, setForm] = useState({ fullName: '', username: '', email: '', className: '', track: '', subjects: 'Coding, Mathematics', schoolId: '', parentId: '' });
  const [resourceForm, setResourceForm] = useState({ studentId: '', type: 'resource' as 'resource' | 'link', title: '', url: '', description: '' });
  const [sending, setSending] = useState(false);

  const token = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Your administrator session has expired.');
    const idToken = await user.getIdToken();
    return idToken;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studentSnap, resourceSnap, linkSnap] = await Promise.all([
        getDocs(query(collection(db, 'individualStudents'), orderBy('createdAt', 'desc'), limit(500))).catch(() => getDocs(query(collection(db, 'individualStudents'), limit(500)))),
        getDocs(query(collection(db, 'personalResources'), orderBy('timestamp', 'desc'), limit(200))).catch(() => getDocs(query(collection(db, 'personalResources'), limit(200)))),
        getDocs(query(collection(db, 'personalLinks'), orderBy('timestamp', 'desc'), limit(200))).catch(() => getDocs(query(collection(db, 'personalLinks'), limit(200)))),
      ]);
      setStudents(studentSnap.docs.map(item => ({ id: item.id, ...item.data() } as Student)));
      const merged: Dispatch[] = [];
      resourceSnap.docs.forEach(item => merged.push({ id: item.id, collectionName: 'personalResources', kind: 'resource', ...item.data() } as Dispatch));
      linkSnap.docs.forEach(item => merged.push({ id: item.id, collectionName: 'personalLinks', kind: 'link', ...item.data() } as Dispatch));
      setDispatches(merged);
    } catch (error) {
      console.error('Admin student operations load failed:', error);
      toast.error('Unable to load student operations.');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(student => [student.fullName, student.username, student.email, student.class, student.grade, student.schoolName].some(value => String(value || '').toLowerCase().includes(term)));
  }, [students, search]);

  const issueCredentials = async (studentId: string) => {
    setSaving(true);
    try {
      const response = await fetch('/api/student-credential-issue', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ studentId }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to issue credentials.');
      setCredentials({ username: result.credentials.username, accessCode: result.credentials.accessCode, portal: result.credentials.portal, fullName: result.student.fullName });
      toast.success('New student portal credentials issued.');
      await load();
    } catch (error: any) { toast.error(error?.message || 'Unable to issue credentials.'); } finally { setSaving(false); }
  };

  const createStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const subjects = form.subjects.split(',').map(item => item.trim()).filter(Boolean);
      const response = await fetch('/api/admin-student-onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ fullName: form.fullName, username: form.username, email: form.email, class: form.className, track: form.track, subjects, schoolId: form.schoolId, parentId: form.parentId }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to create student.');
      setCredentials({ username: result.credentials.username, accessCode: result.credentials.accessCode, portal: result.credentials.portal, fullName: result.student.fullName });
      setShowCreate(false);
      setForm({ fullName: '', username: '', email: '', className: '', track: '', subjects: 'Coding, Mathematics', schoolId: '', parentId: '' });
      toast.success('Student created successfully.');
      await load();
    } catch (error: any) { toast.error(error?.message || 'Unable to create student.'); } finally { setSaving(false); }
  };

  const deleteStudent = async (student: Student) => {
    if (!window.confirm(`Delete ${student.fullName || student.username || 'this student'}? This removes the student record and linked personal learning dispatches.`)) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'individualStudents', student.id));
      const linked = dispatches.filter(item => item.studentId === student.id);
      await Promise.all(linked.map(item => deleteDoc(doc(db, item.collectionName, item.id))));
      toast.success('Student record removed.');
      await load();
    } catch (error: any) { toast.error(error?.message || 'Unable to delete student.'); } finally { setSaving(false); }
  };

  const sendResource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resourceForm.studentId || !resourceForm.title.trim() || !resourceForm.url.trim()) { toast.error('Choose a student and provide a title and URL.'); return; }
    setSending(true);
    try {
      const collectionName = resourceForm.type === 'link' ? 'personalLinks' : 'personalResources';
      const payload = resourceForm.type === 'link'
        ? { studentId: resourceForm.studentId, title: resourceForm.title.trim(), url: resourceForm.url.trim(), description: resourceForm.description.trim(), timestamp: serverTimestamp() }
        : { studentId: resourceForm.studentId, title: resourceForm.title.trim(), fileUrl: resourceForm.url.trim(), description: resourceForm.description.trim(), timestamp: serverTimestamp() };
      await addDoc(collection(db, collectionName), payload);
      setResourceForm({ studentId: '', type: 'resource', title: '', url: '', description: '' });
      toast.success('Learning resource sent to the student.');
      await load();
    } catch (error: any) { toast.error(error?.message || 'Unable to send resource.'); } finally { setSending(false); }
  };

  const copy = async (value: string, label: string) => { await navigator.clipboard.writeText(value); toast.success(`${label} copied.`); };

  return <div className="space-y-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-3"><Users className="h-8 w-8 text-brand-red" aria-hidden="true" /><h1 className="text-3xl font-black text-brand-slate dark:text-white">Student Operations</h1></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage student records, secure portal access, and personalized learning resources.</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"><RefreshCw size={15} aria-hidden="true" /> Refresh</button><button type="button" onClick={() => setShowCreate(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-bold text-white hover:bg-red-700"><UserPlus size={15} aria-hidden="true" /> Add Student</button></div>
    </div>

    <div className="pro-surface rounded-3xl p-5"><div className="relative"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, username, email, class or school…" className="form-control pl-10" aria-label="Search students" /></div></div>

    <section className="pro-surface overflow-hidden rounded-3xl"><div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800"><div><h2 className="text-lg font-black text-slate-900 dark:text-white">Student Directory</h2><p className="mt-1 text-xs text-slate-500">Credential secrets are never stored or displayed here.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{filtered.length} Students</span></div>
      {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading student records…</div> : filtered.length === 0 ? <div className="p-12 text-center"><Users className="mx-auto text-slate-300" size={40} aria-hidden="true" /><p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">No students found</p><p className="mt-1 text-xs text-slate-500">Create a student or adjust your search.</p></div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{filtered.map(student => <div key={student.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red text-sm font-black text-white">{(student.fullName || 'S').charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900 dark:text-white">{student.fullName || 'Unnamed student'}</p><p className="truncate text-xs text-slate-500">@{student.username || 'no-username'} {student.email ? `· ${student.email}` : ''}</p><p className="mt-1 text-[11px] text-slate-500">{student.class || student.grade || 'Class not set'}{student.schoolName ? ` · ${student.schoolName}` : ''}{student.track ? ` · ${student.track}` : ''}</p></div></div><div className="flex flex-wrap gap-2"><span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><ShieldCheck size={13} aria-hidden="true" /> {student.accountStatus || student.status || 'ACTIVE'}</span><button type="button" disabled={saving} onClick={() => issueCredentials(student.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-red px-3 text-[11px] font-bold text-brand-red hover:bg-brand-red hover:text-white disabled:opacity-50"><KeyRound size={14} aria-hidden="true" /> Issue Access Pack</button><button type="button" disabled={saving} onClick={() => deleteStudent(student)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-3 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-950/20"><Trash2 size={14} aria-hidden="true" /> Delete</button></div></div>)}</div>}
    </section>

    <section className="pro-surface rounded-3xl p-6"><div className="mb-5 flex items-center gap-3"><Send size={18} className="text-brand-red" aria-hidden="true" /><div><h2 className="text-lg font-black text-slate-900 dark:text-white">Send Personal Learning Resource</h2><p className="mt-1 text-xs text-slate-500">Deliver a resource or link to one specific student.</p></div></div><form onSubmit={sendResource} className="grid grid-cols-1 gap-4 md:grid-cols-2"><select value={resourceForm.studentId} onChange={event => setResourceForm(current => ({ ...current, studentId: event.target.value }))} className="form-control" required><option value="">Select student</option>{students.map(student => <option key={student.id} value={student.id}>{student.fullName || student.username}</option>)}</select><select value={resourceForm.type} onChange={event => setResourceForm(current => ({ ...current, type: event.target.value as 'resource' | 'link' }))} className="form-control"><option value="resource">Resource</option><option value="link">Link</option></select><input value={resourceForm.title} onChange={event => setResourceForm(current => ({ ...current, title: event.target.value }))} placeholder="Resource title" className="form-control" required /><input value={resourceForm.url} onChange={event => setResourceForm(current => ({ ...current, url: event.target.value }))} placeholder="https://…" type="url" className="form-control" required /><input value={resourceForm.description} onChange={event => setResourceForm(current => ({ ...current, description: event.target.value }))} placeholder="Optional description" className="form-control md:col-span-2" /><div className="md:col-span-2"><button type="submit" disabled={sending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">{sending ? 'Sending…' : 'Send Resource'} <Send size={14} aria-hidden="true" /></button></div></form></section>

    {dispatches.length > 0 && <section className="pro-surface rounded-3xl p-6"><h2 className="text-lg font-black text-slate-900 dark:text-white">Recent Learning Dispatches</h2><div className="mt-4 space-y-2">{dispatches.slice(0, 8).map(item => <div key={`${item.collectionName}-${item.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div><p className="text-xs font-bold text-slate-900 dark:text-white">{item.title || 'Untitled'}</p><p className="text-[11px] text-slate-500">{students.find(student => student.id === item.studentId)?.fullName || 'Student'} · {item.kind}</p></div><span className="text-[10px] font-bold text-slate-400">Delivered</span></div>)}</div></section>}

    {showCreate && <Modal title="Add Student" onClose={() => setShowCreate(false)}><form onSubmit={createStudent} className="space-y-4"><Field label="Full name"><input required value={form.fullName} onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))} className="form-control" /></Field><Field label="Username"><input required value={form.username} onChange={event => setForm(current => ({ ...current, username: event.target.value }))} className="form-control" placeholder="e.g. david.johnson" /></Field><Field label="Email (optional)"><input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className="form-control" /></Field><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Class / Grade"><input value={form.className} onChange={event => setForm(current => ({ ...current, className: event.target.value }))} className="form-control" /></Field><Field label="Learning track"><input value={form.track} onChange={event => setForm(current => ({ ...current, track: event.target.value }))} className="form-control" /></Field></div><Field label="Subjects"><input value={form.subjects} onChange={event => setForm(current => ({ ...current, subjects: event.target.value }))} className="form-control" /><p className="mt-1 text-[11px] text-slate-500">Comma-separated.</p></Field><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="School ID (optional)"><input value={form.schoolId} onChange={event => setForm(current => ({ ...current, schoolId: event.target.value }))} className="form-control" /></Field><Field label="Parent ID (optional)"><input value={form.parentId} onChange={event => setForm(current => ({ ...current, parentId: event.target.value }))} className="form-control" /></Field></div><div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="min-h-11 flex-1 rounded-xl border border-slate-300 text-xs font-bold dark:border-slate-700 dark:text-slate-300">Cancel</button><button type="submit" disabled={saving} className="min-h-11 flex-1 rounded-xl bg-brand-red text-xs font-bold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create Student'}</button></div></form></Modal>}

    {credentials && <Modal title="Student Access Pack" onClose={() => setCredentials(null)}><div className="space-y-5"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-emerald-600" size={19} aria-hidden="true" /><div><p className="text-sm font-black text-emerald-900 dark:text-emerald-200">Credentials issued for {credentials.fullName}</p><p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">This access code is shown once. Store or deliver it securely to the student.</p></div></div></div><CredentialRow label="Username" value={credentials.username} onCopy={() => copy(credentials.username, 'Username')} /><CredentialRow label="Access code" value={credentials.accessCode} onCopy={() => copy(credentials.accessCode, 'Access code')} /><CredentialRow label="Portal" value={credentials.portal} onCopy={() => copy(credentials.portal, 'Portal path')} /><button type="button" onClick={() => setCredentials(null)} className="min-h-11 w-full rounded-xl bg-brand-red text-xs font-bold text-white">Done</button></div></Modal>}
  </div>;
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>{children}</label>;
const CredentialRow: React.FC<{ label: string; value: string; onCopy: () => void }> = ({ label, value, onCopy }) => <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 truncate font-mono text-sm font-bold text-slate-900 dark:text-white">{value}</p></div><button type="button" onClick={onCopy} className="min-h-10 min-w-10 rounded-lg text-slate-500 hover:bg-white hover:text-brand-red dark:hover:bg-slate-800" aria-label={`Copy ${label}`}><Copy size={15} aria-hidden="true" /></button></div>;
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"><div className="mb-5 flex items-start justify-between gap-4"><h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2><button type="button" onClick={onClose} className="min-h-10 min-w-10 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Close ${title}`}><X size={18} /></button></div>{children}</div></div>;

export default AdminStudents;
