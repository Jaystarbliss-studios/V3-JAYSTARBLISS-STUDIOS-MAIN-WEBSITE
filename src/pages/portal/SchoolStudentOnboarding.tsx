import React, { useState } from 'react';
import { Download, FileText, Image as ImageIcon, Loader2, UserPlus, Printer, ShieldCheck } from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

const SchoolStudentOnboarding: React.FC = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', class: 'JSS 1', track: '', parentId: '' });
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; accessCode: string; portal: string } | null>(null);

  const update = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const onboard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.currentUser) return toast.error('Your school session has expired. Please sign in again.');
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/.netlify/functions/school-student-onboard', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to onboard student.');
      setCredentials(result.credentials);
      setForm({ fullName: '', username: '', email: '', class: 'JSS 1', track: '', parentId: '' });
      toast.success('Student account created. Save the credentials before leaving this page.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to onboard student.');
    } finally {
      setSaving(false);
    }
  };

  const credentialText = credentials ? `JAYSTARBLISS STUDIOS — STUDENT ACCESS\n\nUsername: ${credentials.username}\nAccess Code: ${credentials.accessCode}\nStudent Portal: ${window.location.origin}${credentials.portal}\n\nKeep these credentials private and provide them only to the student or authorised parent.` : '';

  const downloadText = () => {
    if (!credentialText) return;
    const blob = new Blob([credentialText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${credentials?.username}-student-access.txt`; a.click(); URL.revokeObjectURL(url);
  };

  const printCredentials = () => {
    if (!credentials) return;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return toast.error('Allow pop-ups to print the credential card.');
    win.document.write(`<html><head><title>Student Access</title><style>body{font-family:Arial,sans-serif;padding:48px;color:#1e293b}.card{max-width:560px;border:2px solid #b91c1c;border-radius:20px;padding:32px}.label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em}.value{font-size:22px;font-weight:800;margin:6px 0 20px}h1{font-size:26px;margin-top:0}</style></head><body><div class="card"><div class="label">Jaystarbliss Studios</div><h1>Student Portal Access</h1><div class="label">Username</div><div class="value">${credentials.username}</div><div class="label">Access Code</div><div class="value">${credentials.accessCode}</div><div class="label">Portal</div><div class="value">${window.location.origin}${credentials.portal}</div></div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  const downloadImage = () => {
    if (!credentials) return;
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 700; const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, canvas.width, 110); ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Arial'; ctx.fillText('JAYSTARBLISS STUDIOS', 60, 70); ctx.fillStyle = '#1e293b'; ctx.font = 'bold 46px Arial'; ctx.fillText('Student Portal Access', 60, 190); ctx.font = '22px Arial'; ctx.fillStyle = '#64748b'; ctx.fillText('Username', 60, 260); ctx.fillStyle = '#1e293b'; ctx.font = 'bold 34px Arial'; ctx.fillText(credentials.username, 60, 305); ctx.fillStyle = '#64748b'; ctx.font = '22px Arial'; ctx.fillText('Access Code', 60, 375); ctx.fillStyle = '#b91c1c'; ctx.font = 'bold 38px Arial'; ctx.fillText(credentials.accessCode, 60, 425); ctx.fillStyle = '#64748b'; ctx.font = '20px Arial'; ctx.fillText(`Portal: ${window.location.origin}${credentials.portal}`, 60, 500); ctx.font = '18px Arial'; ctx.fillText('Keep these credentials private.', 60, 590); const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `${credentials.username}-student-access.png`; a.click();
  };

  return <div className="space-y-6"><SEO title="Onboard School Student | Jaystarbliss Studios" description="Create secure student portal access for a school learner." noindex />
    <div className="pro-surface rounded-3xl p-6 md:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-brand-red/10 p-3 text-brand-red"><UserPlus size={22}/></div><div><div className="text-xs uppercase tracking-widest font-black text-brand-red">School Operations</div><h1 className="text-2xl md:text-3xl font-black mt-1">Onboard a student</h1><p className="text-sm text-slate-500 mt-2 max-w-2xl">Create the learner's account once. They use the same Student Portal as independently enrolled students; their school relationship controls the school-specific learning experience.</p></div></div></div>
    <form onSubmit={onboard} className="pro-surface rounded-2xl p-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Student full name" value={form.fullName} onChange={v=>update('fullName',v)} required/><Field label="Username" value={form.username} onChange={v=>update('username',v)} required/><Field label="Email (optional)" value={form.email} onChange={v=>update('email',v)} type="email"/><label className="text-sm font-bold">Class<select value={form.class} onChange={e=>update('class',e.target.value)} className="mt-2 w-full min-h-11 rounded-xl border border-slate-200 px-3 bg-white"><option>Primary 4</option><option>Primary 5</option><option>JSS 1</option><option>JSS 2</option><option>JSS 3</option><option>SS 1</option><option>SS 2</option><option>SS 3</option></select></label><Field label="Learning track (optional)" value={form.track} onChange={v=>update('track',v)}/><Field label="Parent account ID (optional)" value={form.parentId} onChange={v=>update('parentId',v)}/></div><button disabled={saving} className="min-h-11 mt-5 rounded-xl bg-brand-red text-white px-5 text-sm font-black inline-flex items-center gap-2"><ShieldCheck size={16}/>{saving?<><Loader2 size={16} className="animate-spin"/>Creating secure access…</>:'Create Student Portal Access'}</button></form>
    {credentials && <div className="pro-surface rounded-2xl p-6 border-2 border-brand-red/20"><div className="flex items-start gap-3"><div className="rounded-xl bg-brand-red/10 p-3 text-brand-red"><ShieldCheck size={20}/></div><div><h2 className="font-black text-xl">Credentials created</h2><p className="text-sm text-slate-500 mt-1">Save or distribute these credentials now. The student signs in through the normal Student Portal.</p></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5"><Credential label="Username" value={credentials.username}/><Credential label="Access code" value={credentials.accessCode}/></div><div className="flex flex-wrap gap-3 mt-5"><button type="button" onClick={downloadText} className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-black inline-flex items-center gap-2"><FileText size={15}/>TXT</button><button type="button" onClick={printCredentials} className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-black inline-flex items-center gap-2"><Printer size={15}/>Print / PDF</button><button type="button" onClick={downloadImage} className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-black inline-flex items-center gap-2"><ImageIcon size={15}/>PNG Image</button><a href="/portal" className="min-h-11 rounded-xl bg-brand-slate text-white px-4 text-xs font-black inline-flex items-center gap-2"><Download size={15}/>Student Portal</a></div></div>}
  </div>;
};

const Field = ({ label, value, onChange, type='text', required=false }: { label:string; value:string; onChange:(value:string)=>void; type?:string; required?:boolean }) => <label className="text-sm font-bold">{label}<input required={required} type={type} value={value} onChange={e=>onChange(e.target.value)} className="mt-2 w-full min-h-11 rounded-xl border border-slate-200 px-3 bg-white"/></label>;
const Credential = ({label,value}:{label:string;value:string}) => <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[11px] uppercase tracking-widest text-slate-500 font-black">{label}</div><div className="text-xl font-black mt-1 break-all">{value}</div></div>;
export default SchoolStudentOnboarding;
