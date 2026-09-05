import React from 'react';
import { ArrowRight, ClipboardList, Flag, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import ParentDashboard from './ParentDashboard';
import StaffDashboard from './StaffDashboard';
import StudentDashboard from './StudentDashboard';
import SchoolDashboard from './SchoolDashboard';

const PortalHomeWithBilling: React.FC<{ role: 'student' | 'parent' | 'staff' | 'school' }> = ({ role }) => {
  const dashboard = role === 'parent'
    ? <ParentDashboard />
    : role === 'staff'
      ? <StaffDashboard />
      : role === 'school'
        ? <SchoolDashboard initialTab="overview" />
        : <StudentDashboard />;
  const assignmentPath = `/portal/${role}/assignments`;
  const assignmentLabel = role === 'staff' ? 'Open Teaching Assignments' : role === 'student' ? 'Open My Assignments' : role === 'parent' ? 'View Children’s Assignments' : 'View School Assignments';
  const assignmentDescription = role === 'staff' ? 'Publish work, review submissions and send feedback.' : role === 'student' ? 'Complete assigned work and read tutor feedback.' : role === 'parent' ? 'Monitor submitted work, results and tutor feedback.' : 'Monitor assignment activity across connected learners.';
  const milestonePath = `/portal/${role}/milestones`;
  const milestoneLabel = role === 'staff' ? 'Build Learning Plan' : role === 'student' ? 'View My Milestones' : role === 'parent' ? 'View Learning Milestones' : 'View School Milestones';
  const milestoneDescription = role === 'staff' ? 'Create and update learning roadmaps for assigned learners or schools.' : 'Follow roadmap progress and completed learning milestones.';
  const billingPath = `/portal/${role}/payments`;
  const billingLabel = role === 'staff' ? 'Open Wallet & Payments' : role === 'school' ? 'Open School Billing' : role === 'parent' ? 'Open Tuition & Billing' : 'Open Tuition & Billing';
  const billingDescription = role === 'staff' ? 'Review available earnings, withdrawals and payment history.' : role === 'school' ? 'Review institutional plans, charges and payment history.' : 'Review plans, charges, payment history and receipts.';

  return <div className="space-y-8">
    {dashboard}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="pro-surface rounded-2xl p-5 md:p-6 border border-slate-200/80 dark:border-white/5">
        <div className="flex flex-col gap-4 h-full justify-between">
          <div className="flex items-start gap-3"><div className="h-11 w-11 shrink-0 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center"><ClipboardList size={20} /></div><div><h2 className="font-black text-slate-900 dark:text-white">Assignments</h2><p className="text-xs text-slate-500 mt-1">{assignmentDescription}</p></div></div>
          <Link to={assignmentPath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-red px-5 text-sm font-bold text-white hover:bg-red-700 transition-colors">{assignmentLabel}<ArrowRight size={16} /></Link>
        </div>
      </section>
      <section className="pro-surface rounded-2xl p-5 md:p-6 border border-slate-200/80 dark:border-white/5">
        <div className="flex flex-col gap-4 h-full justify-between">
          <div className="flex items-start gap-3"><div className="h-11 w-11 shrink-0 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><Flag size={20} /></div><div><h2 className="font-black text-slate-900 dark:text-white">Learning milestones</h2><p className="text-xs text-slate-500 mt-1">{milestoneDescription}</p></div></div>
          <Link to={milestonePath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-5 text-sm font-bold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{milestoneLabel}<ArrowRight size={16} /></Link>
        </div>
      </section>
      <section className="pro-surface rounded-2xl p-5 md:p-6 border border-slate-200/80 dark:border-white/5">
        <div className="flex flex-col gap-4 h-full justify-between">
          <div className="flex items-start gap-3"><div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center"><CreditCard size={20} /></div><div><h2 className="font-black text-slate-900 dark:text-white">Billing</h2><p className="text-xs text-slate-500 mt-1">{billingDescription}</p></div></div>
          <Link to={billingPath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-5 text-sm font-bold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{billingLabel}<ArrowRight size={16} /></Link>
        </div>
      </section>
    </div>
  </div>;
};

export default PortalHomeWithBilling;
