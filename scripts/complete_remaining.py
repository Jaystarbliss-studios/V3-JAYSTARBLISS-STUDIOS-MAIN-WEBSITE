from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected marker not found in {path}")
    file.write_text(text.replace(old, new, 1))


# Portal: role is always sourced from an authoritative profile; never from the selected tab.
replace_once(
    'src/pages/Portal.tsx',
    """        const initialRole = detectedRole ? detectedRole.toLowerCase() : activeTab;\n        await setDoc(doc(db, 'users', user.uid), {\n          email: user.email?.toLowerCase(),\n          name: detectedName,\n          role: initialRole,\n          createdAt: serverTimestamp()\n        });\n        detectedRole = initialRole.toUpperCase();\n""",
    """        if (!detectedRole) {\n          await signOut(auth).catch(() => undefined);\n          throw new Error('No active portal profile was found for this account. Please complete registration or contact an administrator.');\n        }\n\n        await setDoc(doc(db, 'users', user.uid), {\n          email: user.email?.toLowerCase(),\n          name: detectedName,\n          role: detectedRole.toLowerCase(),\n          createdAt: serverTimestamp()\n        }, { merge: true });\n""",
)

# Staff admin: remove dead invite state and structural emoji.
staff = Path('src/components/admin/AdminStaff.tsx')
staff_text = staff.read_text()
for line in [
    "  const [inviteName, setInviteName] = useState('');\n",
    "  const [inviteEmail, setInviteEmail] = useState('');\n",
    "  const [inviting, setInviting] = useState(false);\n",
]:
    staff_text = staff_text.replace(line, '')
staff_text = staff_text.replace("                        👨‍🏫 {staff.name || staff.fullName || 'Faculty Member'}", "                        {staff.name || staff.fullName || 'Faculty Member'}")
staff_text = staff_text.replace("                          📞 {staff.phone}", "                          {staff.phone}")
staff.write_text(staff_text)

# Admin Pages: a read-only list should not create Firestore records as a side effect.
pages = Path('src/pages/admin/AdminPages.tsx')
pages_text = pages.read_text()
hydration_loop = """        // Ensure these entries exist in Firestore\n        for (const p of merged) {\n          await setDoc(doc(db, 'pages', p.id), {\n            id: p.id,\n            title: p.title,\n            path: p.path,\n            status: p.status,\n            description: p.description\n          }, { merge: true });\n        }\n        \n"""
if hydration_loop not in pages_text:
    raise SystemExit('AdminPages hydration write block not found')
pages_text = pages_text.replace(hydration_loop, '', 1)
pages_text = pages_text.replace("import { collection, getDocs, doc, setDoc } from 'firebase/firestore';", "import { collection, getDocs } from 'firebase/firestore';")
pages.write_text(pages_text)

# Admin Page Form: support every field type represented in the CMS schema.
form = Path('src/pages/admin/AdminPageForm.tsx')
form_text = form.read_text()
anchor = "const AdminPageForm: React.FC = () => {"
section_field = r'''const SectionField: React.FC<{
  field: EditablePageConfig['sections'][number]['fields'][number];
  value: any;
  onChange: (value: any) => void;
}> = ({ field, value, onChange }) => {
  const base = 'w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red';

  if (field.type === 'image') {
    return <div className="col-span-1 md:col-span-2"><CloudinaryImageUpload label={field.label} value={value || ''} onChange={onChange} helpText="Upload a high-resolution image or paste a Cloudinary URL." /></div>;
  }
  if (field.type === 'textarea') {
    return <div className="col-span-1 md:col-span-2"><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{field.label}</label><textarea rows={5} value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} className={`${base} px-4 py-3 leading-6`} /></div>;
  }
  if (field.type === 'boolean') {
    return <label className="col-span-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800"><input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} className="h-4 w-4" /><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{field.label}</span></label>;
  }
  if (field.type === 'select') {
    return <div className="col-span-1"><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{field.label}</label><select value={value ?? ''} onChange={event => onChange(event.target.value)} className={`${base} min-h-11 px-4 py-3`}><option value="">Select {field.label.toLowerCase()}</option>{(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}</select></div>;
  }
  if (field.type === 'list') {
    const listValue = Array.isArray(value) ? value.join('\n') : String(value ?? '');
    return <div className="col-span-1 md:col-span-2"><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{field.label}</label><textarea rows={6} value={listValue} onChange={event => onChange(event.target.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean))} placeholder={field.placeholder || 'Enter one item per line'} className={`${base} px-4 py-3 leading-6`} /><p className="mt-1 text-[11px] text-slate-400">One item per line.</p></div>;
  }
  if (field.type === 'url') {
    return <div className="col-span-1"><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{field.label}</label><input type="url" value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder={field.placeholder || 'https://'} className={`${base} min-h-11 px-4 py-3`} /></div>;
  }
  return <div className="col-span-1"><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{field.label}</label><input type="text" value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} className={`${base} min-h-11 px-4 py-3`} /></div>;
};

'''
if anchor not in form_text:
    raise SystemExit('AdminPageForm component anchor not found')
if 'const SectionField:' not in form_text:
    form_text = form_text.replace(anchor, section_field + anchor, 1)
renderer = re.compile(r"\{section\.fields\.map\(\(field\) => \{.*?\n\s*\}\)\}\n", re.S)
replacement = """{section.fields.map((field) => {\n                      const value = currentValues[field.key] ?? '';\n                      return <SectionField key={field.key} field={field} value={value} onChange={(nextValue) => handleFieldChange(section.id, field.key, nextValue)} />;\n                    })}\n"""
form_text, changed = renderer.subn(replacement, form_text, count=1)
if changed != 1:
    raise SystemExit('AdminPageForm field renderer block not found')
form.write_text(form_text)

# Hero: expose the CMS tagline and description instead of silently ignoring them.
hero = Path('src/components/Hero.tsx')
hero_text = hero.read_text()
hero_marker = """        <div className=\"text-center lg:text-left max-w-2xl mx-auto lg:mx-0 w-full\">\n          <h1 className=\"text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight break-words\">\n"""
hero_text = hero_text.replace(hero_marker, """        <div className=\"text-center lg:text-left max-w-2xl mx-auto lg:mx-0 w-full\">\n          <span className=\"inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/70 backdrop-blur-sm\">\n            {data.tagline || 'DIGITAL INNOVATION & EDUCATION'}\n          </span>\n          <h1 className=\"mt-5 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight break-words\">\n""", 1)
cta_marker = """          </h1>\n          <div className=\"flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-6 mt-8 w-full max-w-full\">\n"""
if cta_marker not in hero_text:
    raise SystemExit('Hero CTA marker not found')
hero.write_text(hero_text.replace(cta_marker, """          </h1>\n          <p className=\"mx-auto max-w-xl text-base sm:text-lg leading-7 text-white/70 lg:mx-0\">\n            {data.description || 'Jaystarbliss Studios empowers the next generation through practical tech education, coding programs for kids, and scalable software solutions.'}\n          </p>\n          <div className=\"flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-6 mt-8 w-full max-w-full\">\n""", 1))

# Learning Method: make the section CMS-driven while preserving the existing motion system.
learning = Path('src/components/home/LearningMethod.tsx')
learning_text = learning.read_text()
if "usePageSection" not in learning_text:
    learning_text = learning_text.replace("import { motion } from 'motion/react';", "import { motion } from 'motion/react';\nimport { usePageSection } from '../../lib/cms';", 1)
start = learning_text.index('const LearningMethod: React.FC = () => {')
end = learning_text.index('export default LearningMethod;', start)
learning_component = r'''const LearningMethod: React.FC = () => {
  const { data } = usePageSection('home', 'learning_method', {
    title: 'LEARN. PRACTICE. BUILD. SHOWCASE.',
    subtitle: "We believe learning becomes much more meaningful when students get the chance to use what they've learned.",
    step1Title: '1. Foundation & Concepts', step1Desc: 'Master the core ideas before moving into application.',
    step2Title: '2. Guided Practice', step2Desc: 'Work through practical exercises with feedback from experienced mentors.',
    step3Title: '3. Independent Creation', step3Desc: 'Design and implement an original project using the skills you have developed.',
    step4Title: '4. Showcase & Presentation', step4Desc: 'Present the finished work and build a portfolio of real achievements.'
  });
  const steps = [
    { num: '01', title: data.step1Title, description: data.step1Desc },
    { num: '02', title: data.step2Title, description: data.step2Desc },
    { num: '03', title: data.step3Title, description: data.step3Desc },
    { num: '04', title: data.step4Title, description: data.step4Desc },
  ];
  return (
    <section className="py-24 bg-white dark:bg-slate-900 dark:border-slate-800 border-t border-gray-100">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <Reveal className="lg:col-span-5">
            <h2 className="text-3xl md:text-5xl font-extrabold text-brand-slate dark:text-white mb-6 tracking-tight leading-[1.1]">{data.title || 'LEARN. PRACTICE. BUILD. SHOWCASE.'}</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 font-medium leading-relaxed">{data.subtitle || "We believe learning becomes much more meaningful when students get the chance to use what they've learned."}</p>
          </Reveal>
          <div className="lg:col-span-7">
            <StaggerGroup className="space-y-8" staggerDelay={0.12}>
              {steps.map((step) => (
                <motion.div key={step.num} variants={staggerItem} className="flex gap-6 group">
                  <div className="w-16 h-16 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-white/10 flex items-center justify-center text-xl font-black text-brand-red shrink-0 group-hover:bg-brand-red group-hover:text-white group-hover:border-brand-red transition-all shadow-sm">{step.num}</div>
                  <div><h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3><p className="text-lg text-gray-600 dark:text-gray-400 font-medium">{step.description}</p></div>
                </motion.div>
              ))}
            </StaggerGroup>
          </div>
        </div>
      </div>
    </section>
  );
};

'''
learning.write_text(learning_text[:start] + learning_component + learning_text[end:])

# Admin inquiry pipeline: replace any legacy table implementation with the new workflow.
Path('src/pages/admin/AdminInquiries.tsx').write_text(r'''import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { Download, X, Search, Mail, Phone, CalendarDays, UserRound, Filter, Save, ArrowUpRight } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

type LeadStage = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST' | 'CLOSED';
const STAGES: { value: LeadStage; label: string }[] = [
  { value: 'NEW', label: 'New' }, { value: 'CONTACTED', label: 'Contacted' }, { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'CONVERTED', label: 'Converted' }, { value: 'LOST', label: 'Lost' }, { value: 'CLOSED', label: 'Closed' },
];
const toDate = (value: any) => value?.toDate ? value.toDate() : value ? new Date(value) : null;
const formatDate = (value: any, time = false) => { const date = toDate(value); return date && !Number.isNaN(date.getTime()) ? date.toLocaleString(undefined, time ? undefined : { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; };
const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

const AdminInquiries: React.FC = () => {
  const { toast } = useToast();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<'ALL' | LeadStage>('ALL');
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ status: 'NEW' as LeadStage, assignedTo: '', nextFollowUp: '', internalNotes: '' });

  useEffect(() => onSnapshot(collection(db, 'inquiries'), snap => { setInquiries(snap.docs.map(item => ({ id: item.id, ...item.data() }))); setLoading(false); }, error => { console.error(error); setLoading(false); toast.error('Could not load the lead pipeline.'); }), [toast]);
  useEffect(() => { if (selected) setDraft({ status: String(selected.status || 'NEW').toUpperCase() as LeadStage, assignedTo: selected.assignedTo || '', nextFollowUp: selected.nextFollowUp || '', internalNotes: selected.internalNotes || '' }); }, [selected]);

  const counts = useMemo(() => inquiries.reduce<Record<string, number>>((acc, item) => { const key = String(item.status || 'NEW').toUpperCase(); acc.ALL = (acc.ALL || 0) + 1; acc[key] = (acc[key] || 0) + 1; return acc; }, {}), [inquiries]);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return [...inquiries].sort((a,b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)).filter(item => { const itemStage = String(item.status || 'NEW').toUpperCase(); if (stage !== 'ALL' && itemStage !== stage) return false; return !q || [item.name,item.email,item.phone,item.schoolName,item.type,item.role,item.message].filter(Boolean).join(' ').toLowerCase().includes(q); }); }, [inquiries, search, stage]);
  const quickStage = async (item: any, next: LeadStage) => { try { await updateDoc(doc(db, 'inquiries', item.id), { status: next, updatedBy: auth.currentUser?.uid || null, updatedAt: serverTimestamp() }); } catch (error: any) { toast.error(error?.message || 'Could not update lead stage.'); } };
  const save = async () => { if (!selected) return; setSaving(true); try { const previousStatus = String(selected.status || 'NEW').toUpperCase(); await updateDoc(doc(db, 'inquiries', selected.id), { status: draft.status, assignedTo: draft.assignedTo.trim(), nextFollowUp: draft.nextFollowUp || null, internalNotes: draft.internalNotes.trim(), updatedBy: auth.currentUser?.uid || null, updatedAt: serverTimestamp() }); await addDoc(collection(db, 'activityLogs'), { action: 'INQUIRY_UPDATED', inquiryId: selected.id, actorId: auth.currentUser?.uid || null, previousStatus, nextStatus: draft.status, timestamp: serverTimestamp() }).catch(() => undefined); setSelected(null); toast.success('Lead record updated.'); } catch (error: any) { toast.error(error?.message || 'Could not update lead.'); } finally { setSaving(false); } };
  const exportCsv = () => { const headers = ['Name','Email','Phone','Type','School','Status','Assigned To','Next Follow Up','Created At']; const rows = filtered.map(item => [item.name,item.email,item.phone,item.type,item.schoolName,item.status || 'NEW',item.assignedTo,item.nextFollowUp,formatDate(item.createdAt,true)]); const blob = new Blob([[headers.map(escapeCsv).join(','), ...rows.map(row => row.map(escapeCsv).join(','))].join('\n')], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `jaystarbliss_leads_${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url); toast.success(`Exported ${filtered.length} lead${filtered.length === 1 ? '' : 's'}.`); };

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-brand-red text-xs font-black uppercase tracking-[0.18em]"><Filter size={14}/> CRM Pipeline</div><h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Inquiries & Leads</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track inquiries from first contact through qualification, conversion and closure.</p></div><button type="button" onClick={exportCsv} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><Download size={16}/> Export filtered CSV</button></header>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Lead stages"><button type="button" onClick={() => setStage('ALL')} className={`rounded-2xl border p-4 text-left bg-white dark:bg-slate-900 ${stage === 'ALL' ? 'border-brand-red ring-2 ring-brand-red/10' : 'border-slate-200 dark:border-slate-800'}`}><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">All leads</span><strong className="mt-1 block text-xl text-slate-900 dark:text-white">{counts.ALL || 0}</strong></button>{STAGES.map(item => <button key={item.value} type="button" onClick={() => setStage(item.value)} className={`rounded-2xl border p-4 text-left bg-white dark:bg-slate-900 ${stage === item.value ? 'border-brand-red ring-2 ring-brand-red/10' : 'border-slate-200 dark:border-slate-800'}`}><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</span><strong className="mt-1 block text-xl text-slate-900 dark:text-white">{counts[item.value] || 0}</strong></button>)}</section>
    <label className="relative block"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email, school, phone or message…" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="overflow-x-auto"><table className="min-w-[900px] w-full"><thead className="bg-slate-50 dark:bg-slate-950/70"><tr>{['Lead','Source','Stage','Owner / Follow-up','Received','Action'].map(h => <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{loading ? <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-400">Loading lead pipeline…</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-400">No leads match the current filters.</td></tr> : filtered.map(item => { const currentStage = String(item.status || 'NEW').toUpperCase() as LeadStage; return <tr key={item.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-950/50"><td className="px-5 py-4"><div className="font-bold text-slate-900 dark:text-white">{item.name || 'Unnamed lead'}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.email || 'No email'}</div>{item.phone && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.phone}</div>}</td><td className="px-5 py-4"><div className="text-xs font-bold uppercase tracking-wider text-brand-slate dark:text-slate-200">{String(item.type || 'GENERAL').replace(/_/g,' ')}</div>{item.schoolName && <div className="mt-1 text-xs text-slate-500">{item.schoolName}</div>}</td><td className="px-5 py-4"><select value={currentStage} onChange={event => quickStage(item,event.target.value as LeadStage)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-black dark:border-slate-700 dark:bg-slate-900 dark:text-white">{STAGES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td className="px-5 py-4"><div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.assignedTo || 'Unassigned'}</div><div className="mt-1 text-[11px] text-slate-400">{item.nextFollowUp ? `Follow-up ${item.nextFollowUp}` : 'No follow-up set'}</div></td><td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">{formatDate(item.createdAt)}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelected(item)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-brand-red hover:bg-red-50 dark:hover:bg-red-950/30">Open <ArrowUpRight size={14}/></button></td></tr>; })}</tbody></table></div></div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="lead-dialog-title"><div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"><header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-red">Lead record</p><h2 id="lead-dialog-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">{selected.name || 'Unnamed lead'}</h2><p className="mt-1 text-xs text-slate-500">Received {formatDate(selected.createdAt,true)}</p></div><button type="button" onClick={() => setSelected(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close lead details"><X size={20}/></button></header><div className="grid gap-6 overflow-y-auto p-5 lg:grid-cols-[1.15fr_.85fr]"><div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><a href={selected.email ? `mailto:${selected.email}` : undefined} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><Mail size={14}/> Email</div><div className="mt-2 break-all text-sm font-semibold text-brand-red">{selected.email || 'Not provided'}</div></a><a href={selected.phone ? `tel:${selected.phone}` : undefined} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><Phone size={14}/> Phone</div><div className="mt-2 text-sm font-semibold text-slate-800 dark:text-white">{selected.phone || 'Not provided'}</div></a></div>{selected.message && <div><div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Message</div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 whitespace-pre-wrap text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{selected.message}</div></div>}</div><aside className="space-y-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><UserRound size={16}/> Pipeline controls</div><label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Stage</span><select value={draft.status} onChange={event => setDraft(current => ({...current,status:event.target.value as LeadStage}))} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900 dark:text-white">{STAGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">Assigned owner</span><input value={draft.assignedTo} onChange={event => setDraft(current => ({...current,assignedTo:event.target.value}))} placeholder="Staff member / team" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label><label className="block"><span className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500"><CalendarDays size={13}/> Next follow-up</span><input type="date" value={draft.nextFollowUp} onChange={event => setDraft(current => ({...current,nextFollowUp:event.target.value}))} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label><label className="block"><span className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Internal notes</span><textarea rows={7} value={draft.internalNotes} onChange={event => setDraft(current => ({...current,internalNotes:event.target.value}))} placeholder="Private team notes…" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label><button type="button" onClick={save} disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{saving ? 'Saving…' : <><Save size={16}/> Save lead record</>}</button></aside></div></div></div>}
  </div>;
};

export default AdminInquiries;
''')

# Firestore: keep inquiry creation anonymous but constrain it to a bounded public schema.
rules = Path('firestore.rules')
rules_text = rules.read_text()
old_rules = """    match /inquiries/{inquiryId} {\n      allow create: if true;\n      allow read, update, delete: if isAnyAdmin();\n    }\n"""
new_rules = """    match /inquiries/{inquiryId} {\n      allow create: if request.resource.data.keys().hasOnly([\n        'name', 'email', 'phone', 'schoolName', 'type', 'role', 'programsOfInterest', 'message', 'source', 'createdAt'\n      ]) &&\n        request.resource.data.name is string && request.resource.data.name.size() <= 120 &&\n        request.resource.data.email is string && request.resource.data.email.size() <= 254 &&\n        (!request.resource.data.keys().hasAny(['phone']) || (request.resource.data.phone is string && request.resource.data.phone.size() <= 40)) &&\n        (!request.resource.data.keys().hasAny(['schoolName']) || (request.resource.data.schoolName is string && request.resource.data.schoolName.size() <= 160)) &&\n        (!request.resource.data.keys().hasAny(['type']) || (request.resource.data.type is string && request.resource.data.type.size() <= 80)) &&\n        (!request.resource.data.keys().hasAny(['role']) || (request.resource.data.role is string && request.resource.data.role.size() <= 80)) &&\n        (!request.resource.data.keys().hasAny(['source']) || (request.resource.data.source is string && request.resource.data.source.size() <= 80)) &&\n        request.resource.data.message is string && request.resource.data.message.size() <= 5000;\n      allow read, update, delete: if isAnyAdmin();\n    }\n"""
if old_rules not in rules_text:
    raise SystemExit('Inquiry rule block not found')
rules.write_text(rules_text.replace(old_rules, new_rules, 1))

# Current platform documentation.
Path('README.md').write_text('''# Jaystarbliss Studios | Dynamic Hub\n\nThe Jaystarbliss Studios web platform combines the public studio website, education services, role-based portals, school operations, CMS, payments and administrative controls.\n\n## Current platform\n- Public Hub: Home, Programs, Services, Portfolio, Resources, FAQ, Blog, contact and project requests.\n- Portals: Student, Parent, Staff/Tutor and School workspaces with role-aware navigation.\n- School operations: school-scoped learners, resources, links, exams, passcodes and staff-school assignments.\n- Learning operations: resources, calendars, live classes, curriculum and learner progress.\n- Payments: authenticated Paystack initialization plus server-side verification, webhook reconciliation and enrollment-linked payment context.\n- Admin CMS: editable pages/sections, Programs, Services, Portfolio, Kids Zone, News/Blog, Resources, Users & Roles, Approvals, Staff operations and settings.\n- Lead CRM: searchable inquiry pipeline, stage management, ownership, follow-ups, notes and activity logging.\n- Security: Firebase Auth state checks, trusted privileged provisioning, account lifecycle enforcement and school-level access isolation.\n\n## Stack\nReact 19 · TypeScript · Vite · Tailwind CSS · React Router · Firebase Auth/Firestore · Netlify Functions · Paystack · Cloudinary · Motion · Recharts · Lucide React.\n\n## Roles\n`USER`, `STUDENT`, `PARENT`, `STAFF`/`TUTOR`, `SCHOOL`, `CONTENT_ADMIN`, `EDUCATION_ADMIN`, `SERVICES_ADMIN`, `SUPER_ADMIN`.\n\nPrivileged roles are provisioned through trusted server-side workflows. A selected portal tab is never an authorization source.\n\n## Development\n`npm ci` → `npm run dev` → `npm run lint` → `npm run build`\n\nThe GitHub Quality Gate runs lint and production builds for pushes and pull requests targeting `main`.\n\n## Operational docs\nSee `SECURITY_MODEL.md` and `docs/PAYSTACK-OPERATIONS.md` for authorization, trusted workflows and payment operations.\n''')
