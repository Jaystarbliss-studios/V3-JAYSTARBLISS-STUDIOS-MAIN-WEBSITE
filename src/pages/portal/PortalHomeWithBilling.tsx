import React from 'react';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import BillingCenter from './BillingCenter';
import type { BillingCenterRole } from './BillingCenter';
import ParentDashboard from './ParentDashboard';
import StaffDashboard from './StaffDashboard';
import StudentDashboard from './StudentDashboard';
import SchoolDashboard from './SchoolDashboard';

const PortalHomeWithBilling: React.FC<{ role: BillingCenterRole }> = ({ role }) => {
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

  return <div className="space-y-8">
    {dashboard}
    <section className="pro-surface rounded-2xl p-5 md:p-6 border border-slate-200/80 dark:border-white/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center"><ClipboardList size={20} /></div>
          <div><h2 className="font-black text-slate-900 dark:text-white">Assignments</h2><p className="text-xs text-slate-500 mt-1">{assignmentDescription}</p></div>
        </div>
        <Link to={assignmentPath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-red px-5 text-sm font-bold text-white hover:bg-red-700 transition-colors">{assignmentLabel}<ArrowRight size={16} /></Link>
      </div>
    </section>
    <BillingCenter role={role} />
  </div>;
};

export default PortalHomeWithBilling;
