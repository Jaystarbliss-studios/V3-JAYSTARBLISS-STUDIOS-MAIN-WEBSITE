import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard, ShieldCheck, Users } from 'lucide-react';
import AdminBilling from './AdminBilling';

const AdminParents: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="pro-surface rounded-3xl border border-slate-200/80 p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/80 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-red">
              <Users size={14} aria-hidden="true" /> Parent Operations
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white md:text-3xl">Parents, Enrollments &amp; Billing</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Parent payments are managed from the canonical billing ledger so plan, child, teaching mode, duration, transaction fee, payment date and tutor allocation stay synchronized.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/approvals" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:border-brand-red hover:text-brand-red dark:border-slate-700 dark:text-slate-200">
              <Users size={14} aria-hidden="true" /> Enrollment approvals
            </Link>
            <Link to="/admin/billing" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-bold text-white hover:bg-red-700">
              Open full billing <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="pro-surface rounded-2xl border border-slate-200/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <ShieldCheck size={18} className="text-brand-red" aria-hidden="true" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">Verified billing source</p>
          <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">Paystack + canonical ledger</p>
        </div>
        <div className="pro-surface rounded-2xl border border-slate-200/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <CreditCard size={18} className="text-brand-red" aria-hidden="true" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">Payment controls</p>
          <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">Plan pricing &amp; fee policy</p>
        </div>
        <div className="pro-surface rounded-2xl border border-slate-200/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <Users size={18} className="text-brand-red" aria-hidden="true" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">Enrollment path</p>
          <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">Approve → assign → bill → teach</p>
        </div>
      </div>

      <AdminBilling />
    </div>
  );
};

export default AdminParents;
