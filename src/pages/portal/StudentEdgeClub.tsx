import React from 'react';
import { BookOpen, CalendarDays, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/ui/SEO';

const StudentEdgeClub: React.FC = () => {
  const enabled = sessionStorage.getItem('studentEdgeClubEnabled') === 'true';
  if (!enabled) {
    return <div className="min-h-56 grid place-items-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 text-center p-8"><div><ShieldCheck className="mx-auto text-slate-400 mb-3"/><p className="font-black">Edge Club is not enabled for this account</p><p className="text-xs text-slate-500 mt-1">Ask an administrator to enable this programme feature.</p></div></div>;
  }
  return <div className="space-y-5 max-w-5xl mx-auto pb-12">
    <SEO title="Edge Club | Jaystarbliss Studios" description="Student Edge Club workspace." noindex />
    <section className="rounded-3xl bg-slate-950 text-white p-6 md:p-8">
      <p className="text-[10px] uppercase tracking-[0.18em] font-black text-brand-red flex items-center gap-2"><Sparkles size={14}/> Student Feature</p>
      <h1 className="mt-2 text-2xl md:text-3xl font-black">Edge Club</h1>
      <p className="mt-2 text-sm text-slate-300 max-w-2xl">Your Edge Club workspace is enabled by the academy administrator. Use your weekly schedule and learning resources as the starting point for your club activities.</p>
    </section>
    <div className="grid sm:grid-cols-2 gap-4">
      <Link to="/portal/student/calendar" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-brand-red/50"><CalendarDays className="text-brand-red" size={20}/><h2 className="mt-3 text-sm font-black">Club schedule</h2><p className="mt-1 text-xs text-slate-500">See your enabled sessions in the weekly schedule.</p></Link>
      <Link to="/portal/student/resources" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-brand-red/50"><BookOpen className="text-brand-red" size={20}/><h2 className="mt-3 text-sm font-black">Club resources</h2><p className="mt-1 text-xs text-slate-500">Open learning resources assigned to your student portal.</p></Link>
    </div>
  </div>;
};
export default StudentEdgeClub;
