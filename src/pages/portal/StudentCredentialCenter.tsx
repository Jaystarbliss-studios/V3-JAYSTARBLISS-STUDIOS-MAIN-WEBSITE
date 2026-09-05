import React, { useEffect, useState } from 'react';
import { Download, FileText, KeyRound, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import { billingGet, billingPost } from '../../lib/billing';
import { useToast } from '../../contexts/ToastContext';
import SEO from '../../components/ui/SEO';

type Props = { role: 'staff' | 'school' };
type Student = { id: string; fullName?: string; studentName?: string; username?: string; class?: string; grade?: string; schoolName?: string; };

const StudentCredentialCenter: React.FC<Props> = ({ role }) => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issued, setIssued] = useState<Record<string, { username: string; accessCode: string; portal: string }>>({});

  const load = async () => {
    setLoading(true);
    try { const data = await billingGet<any>('billing-data'); setStudents((data.students || []) as Student[]); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to load students.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const issue = async (student: Student) => {
    setBusyId(student.id);
    try {
      const result = await billingPost<any>('student-credential-issue', { studentId: student.id });
      setIssued(prev => ({ ...prev, [student.id]: result.credentials }));
      toast.success(`New access code issued for ${student.fullName || student.studentName || 'student'}. Save it now; it will not be shown again.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to issue credentials.'); }
    finally { setBusyId(null); }
  };

  const exportPack = (student: Student) => {
    const credentials = issued[student.id];
    if (!credentials) { toast.error('Issue a fresh access code before exporting the access pack.'); return; }
    const name = String(student.fullName || student.studentName || 'Student');
    const text = `JAYSTARBLISS STUDIOS\nSTUDENT PORTAL ACCESS\n\nStudent: ${name}\nUsername: ${credentials.username}\nAccess Code: ${credentials.accessCode}\nPortal: ${window.location.origin}/portal\n\nKeep these details private.`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-student-access.txt`; anchor.click(); URL.revokeObjectURL(url);
  };

  const exportPdf = (student: Student) => {
    const credentials = issued[student.id];
    if (!credentials) { toast.error('Issue a fresh access code before exporting the access pack.'); return; }
    const name = String(student.fullName || student.studentName || 'Student');
    const pdf = new jsPDF();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('JAYSTARBLISS STUDIOS', 20, 24); pdf.setFontSize(13); pdf.text('Student Portal Access', 20, 35); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
    [`Student: ${name}`, `Username: ${credentials.username}`, `Access code: ${credentials.accessCode}`, `Portal: ${window.location.origin}/portal`].forEach((line, index) => pdf.text(line, 20, 55 + index * 10));
    pdf.text('Keep this document private and share it only with the assigned student.', 20, 105); pdf.save(`${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-student-access.pdf`);
  };

  return <section className="space-y-6" aria-label="Student credential center"><SEO title="Student Access Packs | Jaystarbliss Studios" description="Securely issue and export student portal credentials." noindex={true}/>
    <div className="pro-surface rounded-3xl p-6 md:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-red"><KeyRound size={14}/> Student Access Packs</div><h2 className="mt-2 text-2xl font-black">Issue secure portal credentials</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Credentials are generated server-side, stored as a hash, and revealed only once when you issue them. Rotate a code whenever access needs to be re-issued.</p></div><button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold"><RefreshCw size={14}/>Refresh</button></div></div>
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300"><ShieldCheck size={17} className="mt-0.5 shrink-0"/><span>Only students assigned to your teaching roster{role === 'school' ? ' or enrolled in your school' : ''} are available here. Never paste access codes into public notes or activity logs.</span></div>
    {loading ? <div className="flex min-h-40 items-center justify-center text-sm text-slate-500"><Loader2 size={18} className="mr-2 animate-spin"/>Loading students…</div> : students.length === 0 ? <div className="pro-surface rounded-2xl p-10 text-center text-sm text-slate-500">No students are currently available for credential issuance.</div> : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{students.map(student => { const credential = issued[student.id]; const name = student.fullName || student.studentName || 'Student'; return <article key={student.id} className="pro-surface rounded-2xl p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-black">{name}</h3><p className="mt-1 text-xs text-slate-500">@{student.username || 'username not issued'}{student.class || student.grade ? ` • ${student.class || student.grade}` : ''}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">Protected</span></div>{credential ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"><p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Fresh credentials</p><p className="mt-2 font-mono text-xs">Username: <strong>{credential.username}</strong></p><p className="mt-1 font-mono text-sm font-black tracking-wider text-brand-red">Access code: {credential.accessCode}</p><p className="mt-2 text-[11px] text-amber-800 dark:text-amber-300">This code is displayed only in this session. Export it now if needed.</p></div> : <div className="mt-4 rounded-xl border border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800">No credential is currently revealed. Issue a new one to create a shareable access pack.</div>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busyId === student.id} onClick={() => void issue(student)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-3.5 text-xs font-bold text-white disabled:opacity-50">{busyId === student.id ? <Loader2 size={13} className="animate-spin"/> : <KeyRound size={13}/>}Issue / Rotate Code</button><button type="button" disabled={!credential} onClick={() => exportPack(student)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"><Download size={13}/>TXT</button><button type="button" disabled={!credential} onClick={() => exportPdf(student)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"><FileText size={13}/>PDF</button></div></article>; })}</div>}
  </section>;
};

export default StudentCredentialCenter;
