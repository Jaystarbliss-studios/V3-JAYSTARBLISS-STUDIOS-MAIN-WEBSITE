import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ExternalLink, Video, Clock } from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { auth, db } from '../../lib/firebase';

interface LiveSession { id:string; title:string; url:string; platform?:string; description?:string; meetingTime?:string; }

const StudentLiveClassrooms: React.FC = () => {
  const [sessions,setSessions]=useState<LiveSession[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(() => {
    let cancelled=false;
    const load=async()=>{
      try {
        const uid=auth.currentUser?.uid || '';
        const studentId=sessionStorage.getItem('studentDocId') || '';
        const snaps=await Promise.all([
          ...(studentId ? [getDocs(query(collection(db,'personalLinks'),where('studentId','==',studentId)))] : []),
          ...(uid ? [getDocs(query(collection(db,'personalLinks'),where('userId','==',uid)))] : [])
        ]);
        const map=new Map<string,LiveSession>();
        snaps.forEach(s=>s.forEach(d=>{ const x=d.data(); map.set(d.id,{id:d.id,title:x.title||'Live Classroom Session',url:x.url||'',platform:x.platform,description:x.description,meetingTime:x.meetingTime}); }));
        if(!cancelled) setSessions(Array.from(map.values()).filter(s=>s.url));
      } catch { if(!cancelled) setSessions([]); } finally { if(!cancelled) setLoading(false); }
    };
    void load();
    return()=>{cancelled=true;};
  },[]);
  return <div className="space-y-6">
    <SEO title="Live Classrooms & Sessions | Jaystarbliss Studios" description="Join live lessons and sessions assigned to your student account." noindex />
    <section className="pro-surface rounded-3xl p-6 md:p-8">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-brand-red/10 p-3 text-brand-red"><Video size={22}/></div>
        <div><p className="text-[10px] font-black uppercase tracking-widest text-brand-red">Live Learning</p><h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Live Classrooms & Sessions</h1><p className="mt-2 text-sm text-slate-500">Join live sessions published specifically for your student account.</p></div>
      </div>
    </section>
    {loading ? <div className="pro-surface rounded-2xl p-10 text-center text-sm text-slate-500">Loading your live sessions…</div> :
      sessions.length===0 ? <div className="pro-surface rounded-2xl border-dashed p-10 text-center"><Video className="mx-auto text-slate-300" size={30}/><p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">No live sessions published yet</p><p className="mt-1 text-xs text-slate-500">Your instructor will publish a classroom link here when a session is scheduled.</p></div> :
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{sessions.map(s=><article key={s.id} className="pro-surface rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><span className="rounded-lg bg-brand-red/10 px-2 py-1 text-[10px] font-black uppercase text-brand-red">{s.platform||'Live Session'}</span>{s.meetingTime&&<span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Clock size={11}/>{s.meetingTime}</span>}</div><h2 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{s.title}</h2>{s.description&&<p className="mt-1 text-xs text-slate-500">{s.description}</p>}<a href={s.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-bold text-white hover:bg-red-700">Join Classroom <ExternalLink size={13}/></a></article>)}</div>}
  </div>;
};
export default StudentLiveClassrooms;
