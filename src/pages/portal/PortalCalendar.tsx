import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Video, ExternalLink, Loader2, ChevronDown, ChevronRight, CheckCircle2, CircleAlert, Timer, BookOpen, Pencil, X, Save, School, UserCheck } from 'lucide-react';
import { auth } from '../../lib/firebase';
import SEO from '../../components/ui/SEO';

type ScheduleStatus = 'upcoming' | 'ongoing' | 'completed' | 'absent' | 'cancelled' | 'rescheduled' | 'scheduled';
interface TimetableEvent { id:string; title:string; dateKey:string; dateLabel:string; dateMs:number; startTime:string; endTime:string; instructor:string; roomOrLink:string; isOnline:boolean; schoolId?:string; schoolName?:string; programmeId?:string; programmeName?:string; className?:string; status:ScheduleStatus; explicitStatus?:string; scheduleGroupId?:string; }

const ordinal = (d:number) => `${d}${d%10===1&&d%100!==11?'st':d%10===2&&d%100!==12?'nd':d%10===3&&d%100!==13?'rd':'th'}`;
const dateLabel = (key:string) => { const d=new Date(`${key}T12:00:00`); return `${d.toLocaleDateString('en-NG',{weekday:'long'})}, ${ordinal(d.getDate())} ${d.toLocaleDateString('en-NG',{month:'long'})} ${d.getFullYear()}`; };
const parseTime=(value:string)=>{const m=String(value||'').trim().toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);if(!m)return null;let h=Number(m[1]);const min=Number(m[2]||0);if(m[3]==='pm'&&h<12)h+=12;if(m[3]==='am'&&h===12)h=0;return {h,min};};
const mins=(v:string)=>{const t=parseTime(v);return t?t.h*60+t.min:0;};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const calcStatus=(date:string,start:string,end:string,explicit?:string):ScheduleStatus=>{const e=String(explicit||'').toUpperCase();if(e==='ABSENT')return'absent';if(e==='CANCELLED')return'cancelled';if(e==='RESCHEDULED')return'rescheduled';if(e==='COMPLETED'||e==='ATTENDED')return'completed';const t=today();if(date>t)return'upcoming';if(date<t)return'completed';const n=new Date().getHours()*60+new Date().getMinutes();const s=mins(start),f=mins(end);return n<s?'upcoming':n<=f?'ongoing':'completed';};
const statusMeta:Record<ScheduleStatus,{label:string;icon:React.ReactNode}>= {upcoming:{label:'Upcoming',icon:<Timer size={13}/>},ongoing:{label:'Ongoing now',icon:<span className="h-2 w-2 rounded-full bg-white animate-pulse"/>},completed:{label:'Completed',icon:<CheckCircle2 size={13}/>},absent:{label:'Absent',icon:<CircleAlert size={13}/>},cancelled:{label:'Cancelled',icon:<CircleAlert size={13}/>},rescheduled:{label:'Rescheduled',icon:<CalendarIcon size={13}/>},scheduled:{label:'Scheduled',icon:<CalendarIcon size={13}/>} };

const PortalCalendar:React.FC=()=>{
 const [events,setEvents]=useState<TimetableEvent[]>([]); const [selectedProgramme,setSelectedProgramme]=useState('ALL'); const [selectedSchool,setSelectedSchool]=useState('ALL'); const [selectedStatus,setSelectedStatus]=useState<'ALL'|ScheduleStatus>('ALL'); const [loading,setLoading]=useState(true); const [message,setMessage]=useState(''); const [expandedDays,setExpandedDays]=useState<Record<string,boolean>>({}); const [editing,setEditing]=useState<TimetableEvent|null>(null); const [editForm,setEditForm]=useState({title:'',date:'',startTime:'',endTime:'',meetingLink:''}); const [saving,setSaving]=useState(false); const [updatingId,setUpdatingId]=useState<string|null>(null); const [,setClock]=useState(0);
 const role=String(sessionStorage.getItem('userRole')||'').toUpperCase(); const canManage=['STAFF','TUTOR','INSTRUCTOR','FACULTY'].includes(role);
 const load=useCallback(async()=>{
  setLoading(true);
  setMessage('');
  try {
    const user=auth.currentUser;
    if(!user) throw new Error('Please sign in again.');
    const token=await user.getIdToken();
    const schoolId = sessionStorage.getItem('studentSchoolId') || sessionStorage.getItem('schoolId') || '';
    const studentId = sessionStorage.getItem('studentDocId') || '';
    const studentClass = (sessionStorage.getItem('studentClass') || '').trim().toLowerCase();
    const studentSchoolName = (sessionStorage.getItem('studentSchoolName') || '').trim().toLowerCase();
    const studentProg = (sessionStorage.getItem('studentPlan') || sessionStorage.getItem('studentTrack') || '').trim().toLowerCase();

    const netRes = await fetch(`/.netlify/functions/class-schedules?schoolId=${encodeURIComponent(schoolId)}&studentId=${encodeURIComponent(studentId)}`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():{schedules:[]}).catch(()=>({schedules:[]}));

    const combinedRaw = Array.isArray(netRes?.schedules) ? netRes.schedules : [];

    const seenIds = new Set<string>();
    const filteredRaw = combinedRaw.filter((x: any) => {
      if (!x || !x.id || seenIds.has(x.id)) return false;
      seenIds.add(x.id);

      if (role === 'STUDENT') {
        if (x.studentId && (x.studentId === studentId || x.studentId === user.uid)) return true;
        const xSchId = (x.schoolId || '').trim();
        const xSchName = (x.schoolName || '').trim().toLowerCase();
        const isSchoolMatch = (schoolId && xSchId === schoolId) || (studentSchoolName && xSchName && (xSchName === studentSchoolName || xSchName.includes(studentSchoolName) || studentSchoolName.includes(xSchName)));
        const xProg = String(x.programName || x.title || '').trim().toLowerCase();
        const isProgMatch = studentProg && (xProg === studentProg || xProg.includes(studentProg) || studentProg.includes(xProg));

        if (isSchoolMatch || isProgMatch || x.targetType === 'ALL') {
          if (studentClass) {
            const xClass = String(x.classLevel || '').trim().toLowerCase();
            const xLevels = Array.isArray(x.classLevels) ? x.classLevels.map((l: string) => String(l).trim().toLowerCase()) : [];
            if (!xClass && xLevels.length === 0) return true;
            if (xClass === 'all' || xClass === 'all classes' || xClass === 'general' || xClass === studentClass || studentClass.includes(xClass) || xClass.includes(studentClass)) return true;
            if (xLevels.some((l: string) => l === 'all' || l === 'all classes' || l === 'general' || l === studentClass || studentClass.includes(l) || l.includes(studentClass))) return true;
            const studentClassNum = studentClass.replace(/\D/g, '');
            const xClassNum = xClass.replace(/\D/g, '');
            if (studentClassNum && xClassNum && studentClassNum === xClassNum) return true;
          } else {
            return true;
          }
        }
        return false;
      }
      return true;
    });

    const mapped:TimetableEvent[]=filteredRaw.map((x:any)=>{
      const key=String(x.date||'').slice(0,10);
      const start=String(x.startTime||'08:00');
      const end=String(x.endTime||'08:40');
      return{
        id:x.id,
        title:x.title||x.programName||'Class Session',
        dateKey:key,
        dateLabel:dateLabel(key),
        dateMs:new Date(`${key}T12:00:00`).getTime(),
        startTime:start,
        endTime:end,
        instructor:x.tutorName||'Tutor not assigned',
        roomOrLink:x.meetingLink||x.url||'',
        isOnline:Boolean(x.meetingLink||x.url),
        schoolId:x.schoolId,
        schoolName:x.schoolName,
        programmeId:x.programId||x.programmeId,
        programmeName:x.programName||x.programmeName||x.title,
        className:x.classLevel||(Array.isArray(x.classLevels)?x.classLevels.join(', '):'All classes'),
        status:calcStatus(key,start,end,x.status),
        explicitStatus:x.status,
        scheduleGroupId:x.scheduleGroupId
      };
    }).filter((e:TimetableEvent)=>Boolean(e.dateKey));

    mapped.sort((a,b)=>a.dateMs-b.dateMs||mins(a.startTime)-mins(b.startTime));
    setEvents(mapped);
    if(!mapped.length) setMessage('No class schedules are currently assigned to this account.');
  } catch(e:any){
    console.error('Schedule loading failed:',e);
    setEvents([]);
    setMessage(e?.message||'Schedule data could not be loaded.');
  } finally {
    setLoading(false);
  }
 },[role]);
 useEffect(()=>{void load();},[load]); useEffect(()=>{const id=window.setInterval(()=>setClock(v=>v+1),30000);return()=>window.clearInterval(id);},[]);
 const programmes=useMemo(()=>{
  const map = new Map<string, string>();
  events.forEach(e => {
    if (e.programmeName) map.set(e.programmeName, e.programmeName);
    if (e.programmeId && !map.has(e.programmeId)) map.set(e.programmeId, e.programmeName || 'Programme');
  });
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
 },[events]);
 const schools=useMemo(()=>Array.from(new Map(events.filter(e=>e.schoolId).map(e=>[e.schoolId||'',e.schoolName||'School'])).entries()).map(([id,name])=>({id,name})),[events]);
 const filtered=useMemo(()=>events.filter(e=>(selectedProgramme==='ALL'||e.programmeId===selectedProgramme||e.programmeName===selectedProgramme)&&(selectedSchool==='ALL'||e.schoolId===selectedSchool)&&(selectedStatus==='ALL'||e.status===selectedStatus)),[events,selectedProgramme,selectedSchool,selectedStatus]);
 const ongoing=filtered.find(e=>e.status==='ongoing'); const next=filtered.find(e=>e.status==='upcoming'); const previous=[...filtered].filter(e=>['completed','absent','cancelled'].includes(e.status)).sort((a,b)=>b.dateMs-a.dateMs||mins(b.startTime)-mins(a.startTime))[0];
 const grouped=useMemo(()=>{const m=new Map<string,TimetableEvent[]>();filtered.forEach(e=>{if(!m.has(e.dateKey))m.set(e.dateKey,[]);m.get(e.dateKey)!.push(e);});return Array.from(m.entries()).sort(([a],[b])=>a.localeCompare(b));},[filtered]);
 const updateStatus=async(event:TimetableEvent,status:'COMPLETED'|'ABSENT'|'CANCELLED'|'RESCHEDULED')=>{if(!canManage)return;setUpdatingId(event.id);try{const user=auth.currentUser;if(!user)throw new Error('Please sign in again.');const token=await user.getIdToken();const r=await fetch('/.netlify/functions/class-schedules',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({scheduleId:event.id,status})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Unable to update class status.');await load();}catch(e:any){setMessage(e?.message||'Unable to update class status.');}finally{setUpdatingId(null);}};
 const openEdit=(e:TimetableEvent)=>{setEditing(e);setEditForm({title:e.title,date:e.dateKey,startTime:e.startTime,endTime:e.endTime,meetingLink:e.roomOrLink});};
 const saveEdit=async(ev:React.FormEvent)=>{ev.preventDefault();if(!editing||!canManage)return;setSaving(true);try{const user=auth.currentUser;if(!user)throw new Error('Please sign in again.');const token=await user.getIdToken();const r=await fetch('/.netlify/functions/class-schedules',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({scheduleId:editing.id,...editForm})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Unable to save schedule.');setEditing(null);await load();}catch(e:any){setMessage(e?.message||'Unable to save schedule.');}finally{setSaving(false);}};
 const badge=(status:ScheduleStatus)=>{const m=statusMeta[status];const c=status==='ongoing'?'bg-emerald-500 text-white border-emerald-400':status==='completed'?'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800':status==='absent'?'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800':'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700';return<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase ${c}`}>{m.icon}{m.label}</span>;};
 return <div className="space-y-5"><SEO title="Class Schedules | Jaystarbliss Studios" description="Programme-based class schedules and current class status." noindex={true}/>
  <section className="rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900"><div className="p-5 md:p-7 bg-slate-950 text-white"><div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5"><div><div className="flex items-center gap-2 text-brand-red text-[10px] font-black uppercase tracking-[0.18em] mb-2"><CalendarIcon size={14}/> Class Schedules</div><h1 className="text-2xl md:text-3xl font-black">Your programme schedule</h1><p className="mt-2 text-xs md:text-sm text-slate-300 max-w-2xl">Schedules are listed chronologically and grouped by programme, school and date.</p></div><div className="flex flex-wrap gap-2"><select value={selectedProgramme} onChange={e=>setSelectedProgramme(e.target.value)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white"><option value="ALL" className="text-slate-900">All enrolled programmes</option>{programmes.map(p=><option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>)}</select>{role !== 'STUDENT' && schools.length>0&&<select value={selectedSchool} onChange={e=>setSelectedSchool(e.target.value)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white"><option value="ALL" className="text-slate-900">All schools</option>{schools.map(s=><option key={s.id} value={s.id} className="text-slate-900">{s.name}</option>)}</select>}<select value={selectedStatus} onChange={e=>setSelectedStatus(e.target.value as any)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white"><option value="ALL" className="text-slate-900">All statuses</option><option value="upcoming" className="text-slate-900">Upcoming</option><option value="ongoing" className="text-slate-900">Ongoing</option><option value="completed" className="text-slate-900">Completed</option><option value="absent" className="text-slate-900">Absent</option></select></div></div></div>
   {(ongoing||next||previous)&&<div className="p-4 md:p-5 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800"><div className={`rounded-2xl border p-5 md:p-6 ${ongoing?'border-emerald-300 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20':'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}><div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 mb-2">{ongoing?<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase"><span className="h-2 w-2 rounded-full bg-white animate-pulse"/> Ongoing now</span>:next?<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-red text-white text-[10px] font-black uppercase"><Timer size={12}/> Next class</span>:<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 text-[10px] font-black uppercase"><CheckCircle2 size={12}/> Previous class completed</span>}</div><h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white truncate">{(ongoing||next||previous)?.title}</h2><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1.5 font-bold"><CalendarIcon size={13}/>{(ongoing||next||previous)?.dateLabel}</span><span className="inline-flex items-center gap-1.5"><Clock size={13}/>{(ongoing||next||previous)?.startTime} – {(ongoing||next||previous)?.endTime}</span><span className="inline-flex items-center gap-1.5"><UserCheck size={13}/>{(ongoing||next||previous)?.instructor}</span></div></div>{next&&!ongoing&&<div className="text-left lg:text-right shrink-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Next scheduled</p><p className="text-sm font-black text-slate-800 dark:text-white">{next.dateLabel}</p></div>}</div></div></div>}
  </section>
  {loading?<div className="py-16 flex items-center justify-center gap-2 text-xs text-slate-500"><Loader2 size={18} className="animate-spin"/> Loading your schedules…</div>:!grouped.length?<div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800"><CalendarIcon size={32} className="mx-auto text-slate-300 dark:text-slate-600"/><p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">{message||'No class schedules found'}</p><p className="mt-1 text-xs text-slate-500">Schedules appear here automatically when a programme or class is assigned to this account.</p></div>:<div className="space-y-5">{grouped.map(([date,items])=>{const expanded=expandedDays[date]!==false;return <section key={date} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"><button type="button" onClick={()=>setExpandedDays(v=>({...v,[date]:!expanded}))} className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40"><span className="flex items-center gap-2"><CalendarIcon size={15} className="text-brand-red"/><span className="text-sm font-black text-slate-900 dark:text-white">{dateLabel(date)}</span><span className="text-[10px] font-bold text-slate-400">{items.length} class{items.length===1?'':'es'}</span></span>{expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</button>{expanded&&<div className="divide-y divide-slate-100 dark:divide-slate-800/80">{items.map(event=><article key={event.id} className={`p-4 md:p-5 ${event.status==='ongoing'?'bg-emerald-50/40 dark:bg-emerald-950/15':''}`}><div className="flex flex-col lg:flex-row lg:items-center gap-4"><div className="shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-center min-w-[115px]"><p className="text-[9px] uppercase font-black text-slate-400">Time</p><p className="text-xs font-black font-mono text-slate-800 dark:text-white">{event.startTime} – {event.endTime}</p></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">{badge(event.status)}<span className="px-2 py-1 rounded-md bg-red-50 dark:bg-red-950/30 text-brand-red border border-red-100 dark:border-red-900/30 text-[10px] font-black uppercase">{event.className}</span>{event.schoolName&&<span className="px-2 py-1 rounded-md bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 text-[10px] font-bold inline-flex items-center gap-1"><School size={11}/>{event.schoolName}</span>}</div><h3 className="mt-2 text-sm md:text-base font-black text-slate-900 dark:text-white">{event.title}</h3><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><BookOpen size={12}/>{event.programmeName||'Programme'}</span><span className="inline-flex items-center gap-1"><UserCheck size={12}/>{event.instructor}</span>{event.isOnline&&<a href={event.roomOrLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-600 font-bold hover:underline"><Video size={12}/>Live room<ExternalLink size={11}/></a>}</div></div>{canManage&&<div className="flex items-center gap-2 shrink-0"><button type="button" onClick={()=>openEdit(event)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"><Pencil size={13}/>Edit</button><select disabled={updatingId===event.id} value={event.explicitStatus||event.status.toUpperCase()} onChange={e=>{const v=e.target.value;if(['COMPLETED','ABSENT','CANCELLED','RESCHEDULED'].includes(v))void updateStatus(event,v as any);}} className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"><option value="UPCOMING">Upcoming</option><option value="ONGOING">Ongoing</option><option value="COMPLETED">Completed</option><option value="ABSENT">Absent</option><option value="RESCHEDULED">Rescheduled</option><option value="CANCELLED">Cancelled</option></select></div>}</div></article>)}</div>}</section>})}</div>}
  {editing&&<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><form onSubmit={saveEdit} className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-brand-red">Edit schedule</p><h3 className="text-lg font-black text-slate-900 dark:text-white">{editing.programmeName||'Class schedule'}</h3></div><button type="button" onClick={()=>setEditing(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></button></div><label className="block text-xs font-bold">Class title<input value={editForm.title} onChange={e=>setEditForm(v=>({...v,title:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"/></label><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><label className="block text-xs font-bold">Date<input type="date" value={editForm.date} onChange={e=>setEditForm(v=>({...v,date:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"/></label><label className="block text-xs font-bold">Start<input type="time" value={editForm.startTime} onChange={e=>setEditForm(v=>({...v,startTime:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"/></label><label className="block text-xs font-bold">End<input type="time" value={editForm.endTime} onChange={e=>setEditForm(v=>({...v,endTime:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"/></label></div><label className="block text-xs font-bold">Live room / meeting link<input value={editForm.meetingLink} onChange={e=>setEditForm(v=>({...v,meetingLink:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"/></label><div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditing(null)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2.5 rounded-xl bg-brand-red text-white text-xs font-black inline-flex items-center gap-2">{saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>}Save changes</button></div></form></div>}
 </div>;
};
export default PortalCalendar;
export { PortalCalendar };
