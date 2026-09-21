import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Loader2, Plus, RefreshCw, School, XCircle } from "lucide-react";
import SEO from "../../components/ui/SEO";
import { auth, db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useToast } from "../../contexts/ToastContext";

const CLASS_OPTIONS = ["Year 1","Year 2","Year 3","Year 4","Year 5","JSS 1","JSS 2","JSS 3","SS1","SS2","SS3"];
const STATUS_OPTIONS = ["SCHEDULED","COMPLETED","ATTENDED","ABSENT","CANCELLED","RESCHEDULED"];

type Schedule = Record<string,any> & { id:string };
type School = { id:string; name:string };

const AdminClassSchedules:React.FC = () => {
  const { toast } = useToast();
  const [schools,setSchools] = useState<School[]>([]);
  const [schedules,setSchedules] = useState<Schedule[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [filterSchool,setFilterSchool] = useState("");
  const [showForm,setShowForm] = useState(false);
  const [form,setForm] = useState({
    schoolId:"", classLevel:"Year 1", title:"STEM Class", tutorName:"",
    startDate:new Date().toISOString().slice(0,10), startTime:"09:00", endTime:"11:00",
    recurring:true, weeks:"52"
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schoolSnap] = await Promise.all([getDocs(collection(db,"schools"))]);
      const schoolList = schoolSnap.docs.map(d=>({id:d.id,name:String(d.data().name||d.data().schoolName||d.id)})).sort((a,b)=>a.name.localeCompare(b.name));
      setSchools(schoolList);
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication required.");
      const token = await user.getIdToken(true);
      const response = await fetch(`/.netlify/functions/class-schedules${filterSchool ? `?schoolId=${encodeURIComponent(filterSchool)}` : ""}`,{headers:{Authorization:`Bearer ${token}`}});
      const result = await response.json();
      if(!response.ok) throw new Error(result.error||"Unable to load class schedules.");
      setSchedules(Array.isArray(result.schedules)?result.schedules:[]);
    } catch(e){ toast.error(e instanceof Error?e.message:"Unable to load schedules."); }
    finally{setLoading(false);}
  }, [filterSchool, toast]);

  useEffect(()=>{void load();},[load]);

  const create = async (e:React.FormEvent) => {
    e.preventDefault();
    if(!form.schoolId) return toast.error("Select a school.");
    setSaving(true);
    try{
      const user=auth.currentUser;if(!user)throw new Error("Authentication required.");
      const token=await user.getIdToken(true);
      const school=schools.find(s=>s.id===form.schoolId);
      const response=await fetch("/.netlify/functions/class-schedules",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({...form,schoolName:school?.name||"",weeks:Number(form.weeks)||52})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Unable to create schedule.");
      toast.success(`Schedule created with ${result.occurrences} weekly occurrence${result.occurrences===1?"":"s"}.`);
      setShowForm(false); await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Unable to create schedule.");}
    finally{setSaving(false);}
  };

  const setStatus=async(id:string,status:string)=>{
    try{
      const user=auth.currentUser;if(!user)throw new Error("Authentication required.");
      const token=await user.getIdToken(true);
      const response=await fetch("/.netlify/functions/class-schedules",{method:"PATCH",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({scheduleId:id,status})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to update class.");
      setSchedules(prev=>prev.map(s=>s.id===id?{...s,status}:s));
    }catch(e){toast.error(e instanceof Error?e.message:"Unable to update class.");}
  };

  const grouped = useMemo(()=>schedules.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.startTime).localeCompare(String(b.startTime))),[schedules]);

  return <div className="space-y-6">
    <SEO title="Class Schedules | Admin" description="Manage recurring school class schedules and attendance history." noindex />
    <div className="pro-surface rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div><h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Class Schedules</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">Set weekly school classes once, keep a permanent occurrence history, and record what happened to every class date.</p></div>
      <div className="flex gap-2"><button type="button" onClick={()=>void load()} className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-black inline-flex items-center gap-2"><RefreshCw size={15}/>Refresh</button><button type="button" onClick={()=>setShowForm(v=>!v)} className="min-h-11 rounded-xl bg-brand-red text-white px-4 text-xs font-black inline-flex items-center gap-2"><Plus size={15}/>New Schedule</button></div>
    </div>

    <div className="pro-surface rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
      <div className="flex-1"><label className="text-[11px] uppercase tracking-wider font-black text-slate-500">School</label><select value={filterSchool} onChange={e=>setFilterSchool(e.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-3"><option value="">All schools</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div className="flex items-end text-xs font-bold text-slate-500">{schedules.length} occurrence{schedules.length===1?"":"s"} loaded</div>
    </div>

    {showForm && <form onSubmit={create} className="pro-surface rounded-2xl p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-black text-lg text-slate-900 dark:text-white">Create class schedule</h2><button type="button" onClick={()=>setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><XCircle size={18}/></button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="School"><select value={form.schoolId} onChange={e=>setForm({...form,schoolId:e.target.value})} className={inputClass}><option value="">Select school</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Class"><select value={form.classLevel} onChange={e=>setForm({...form,classLevel:e.target.value})} className={inputClass}>{CLASS_OPTIONS.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Class / programme title"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className={inputClass} placeholder="e.g. STEM & Coding"/></Field>
        <Field label="Tutor / instructor"><input value={form.tutorName} onChange={e=>setForm({...form,tutorName:e.target.value})} className={inputClass} placeholder="Assigned tutor"/></Field>
        <Field label="First class date"><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} className={inputClass}/></Field>
        <Field label="Start time"><input type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})} className={inputClass}/></Field>
        <Field label="End time"><input type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})} className={inputClass}/></Field>
        <Field label="Recurring"><select value={form.recurring?"yes":"no"} onChange={e=>setForm({...form,recurring:e.target.value==="yes"})} className={inputClass}><option value="yes">Every week</option><option value="no">One-time class</option></select></Field>
        {form.recurring && <Field label="Occurrences"><input type="number" min="1" max="52" value={form.weeks} onChange={e=>setForm({...form,weeks:e.target.value})} className={inputClass}/></Field>}
      </div>
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-600 dark:text-slate-300">Recurring schedules create individual weekly occurrences, so each date can later be marked completed, attended, absent, cancelled, or rescheduled without destroying the history.</div>
      <button disabled={saving} className="min-h-11 rounded-xl bg-brand-red text-white px-5 text-xs font-black inline-flex items-center gap-2">{saving?<Loader2 size={15} className="animate-spin"/>:<CalendarDays size={15}/>} {saving?"Creating…":"Create Schedule"}</button>
    </form>}

    <div className="pro-surface rounded-2xl overflow-hidden">
      {loading?<div className="p-10 text-center text-sm text-slate-500"><Loader2 className="animate-spin mx-auto mb-2" size={20}/>Loading schedules…</div>:grouped.length===0?<div className="p-10 text-center"><CalendarDays className="mx-auto text-slate-400" size={30}/><p className="font-black mt-3 text-slate-900 dark:text-white">No class schedules yet</p><p className="text-xs text-slate-500 mt-1">Create the first recurring class schedule above.</p></div>:<div className="overflow-x-auto"><table className="w-full text-left text-xs min-w-[1050px]"><thead className="bg-slate-50 dark:bg-slate-950/70"><tr>{["Date","School","Class","Class / Programme","Tutor","Time","Status","Update"].map(h=><th key={h} className="px-4 py-3 font-black uppercase tracking-wider text-slate-500">{h}</th>)}</tr></thead><tbody>{grouped.map(s=><tr key={s.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">{new Date(`${s.date}T00:00:00`).toLocaleDateString("en-NG",{dateStyle:"medium"})}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.schoolName}</td><td className="px-4 py-3 font-bold">{s.classLevel}</td><td className="px-4 py-3">{s.title}</td><td className="px-4 py-3">{s.tutorName||"—"}</td><td className="px-4 py-3 whitespace-nowrap"><Clock3 size={13} className="inline mr-1"/>{s.startTime}–{s.endTime}</td><td className="px-4 py-3"><Status status={s.status}/></td><td className="px-4 py-3"><select value={s.status} onChange={e=>void setStatus(s.id,e.target.value)} className="min-h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-2">{STATUS_OPTIONS.map(v=><option key={v}>{v}</option>)}</select></td></tr>)}</tbody></table></div>}
    </div>
  </div>;
};

const inputClass="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-3";
const Field:React.FC<{label:string;children:React.ReactNode}> = ({label,children}) => <label className="text-xs font-black text-slate-700 dark:text-slate-300">{label}<div className="mt-1">{children}</div></label>;
const Status:React.FC<{status:string}> = ({status}) => <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black ${status==="COMPLETED"||status==="ATTENDED"?"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300":status==="CANCELLED"||status==="ABSENT"?"bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300":"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{status==="COMPLETED"||status==="ATTENDED"?<CheckCircle2 size={11}/>:<Clock3 size={11}/>} {status}</span>;
export default AdminClassSchedules;