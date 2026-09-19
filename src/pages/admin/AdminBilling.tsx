import React, { useEffect, useMemo, useState } from 'react';
import { 
  Activity, CheckCircle2, DollarSign, Edit3, Loader2, Save, 
  ShieldCheck, TrendingUp, Users, Wallet, School, Bell, 
  Send, Calendar, Clock, CreditCard, RefreshCw, ChevronRight, Check
} from 'lucide-react';
import { billingGet, billingPost, dateLabel, formatNaira } from '../../lib/billing';
import SEO from '../../components/ui/SEO';
import { useToast } from '../../contexts/ToastContext';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type Plan = Record<string, any> & { id: string };
type Policy = { percentage: string; flat: string; cap: string; waiveFlatBelow?: string; enabled: boolean };
const money = (v: any) => formatNaira(Number(v || 0));
const monthKey = (v: any) => { 
  const d = new Date(v); 
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 7); 
};

const inputClass = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red';

const AdminBilling: React.FC = () => {
  const { toast } = useToast();
  const [data, setData] = useState<any>({
    config: { plans: {}, parentFeePolicy: {}, schoolFeePolicy: {}, withdrawalFeePolicy: {} },
    payments: [],
    enrollments: [],
    withdrawals: [],
    staff: []
  });
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schools' | 'policies'>('overview');
  const [saving, setSaving] = useState('');
  const [role, setRole] = useState('admin');
  
  // Plans & Policies
  const [selectedPlan, setSelectedPlan] = useState('');
  const [planDraft, setPlanDraft] = useState({ name: '', baseAmount: '', durationWeeks: '', teachingModes: '' });
  const [parentPolicy, setParentPolicy] = useState<Policy>({ percentage: '', flat: '', cap: '', waiveFlatBelow: '', enabled: true });
  const [schoolPolicy, setSchoolPolicy] = useState<Policy>({ percentage: '', flat: '', cap: '', waiveFlatBelow: '', enabled: true });
  const [withdrawalPolicy, setWithdrawalPolicy] = useState<Policy>({ percentage: '', flat: '', cap: '', enabled: false });
  const [minimumWithdrawal, setMinimumWithdrawal] = useState('10000');

  // Quick school fee editor
  const [editingSchoolBilling, setEditingSchoolBilling] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [billingResult, schoolSnap] = await Promise.all([
        billingGet<any>('billing-data'),
        getDocs(collection(db, 'schools')).catch(() => ({ docs: [] } as any))
      ]);

      setData(billingResult);
      setRole(String(sessionStorage.getItem('userRole') || billingResult.role || 'admin').toLowerCase());
      setParentPolicy({ ...billingResult.config.parentFeePolicy });
      setSchoolPolicy({ ...billingResult.config.schoolFeePolicy });
      setWithdrawalPolicy({ ...billingResult.config.withdrawalFeePolicy });
      setMinimumWithdrawal(String(billingResult.config.minimumWithdrawalAmount || 10000));

      const loadedSchools = schoolSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setSchools(loadedSchools);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to load billing operations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const plans = Object.values((data.config?.plans || {}) as Record<string, Plan>);
  const paid = useMemo(() => (data.payments || []).filter((p: any) => String(p.status).toUpperCase() === 'PAID'), [data.payments]);
  const withdrawals = useMemo(() => data.withdrawals || [], [data.withdrawals]);
  const paidWithdrawals = useMemo(() => withdrawals.filter((w: any) => ['PAID', 'SUCCESS', 'SUCCESSFUL'].includes(String(w.status).toUpperCase())), [withdrawals]);

  const totalGross = useMemo(() => paid.reduce((s: number, p: any) => s + Number(p.customerTotal || Number(p.amount || 0) / 100), 0), [paid]);
  const totalFees = useMemo(() => paid.reduce((s: number, p: any) => s + Number(p.transactionFee || 0), 0), [paid]);
  const tutorAllocated = useMemo(() => paid.reduce((s: number, p: any) => s + (p.tutorId ? Number(p.baseAmount || Number(p.amount || 0) / 100) : 0), 0), [paid]);
  const withdrawalFees = useMemo(() => paidWithdrawals.reduce((s: number, w: any) => s + Number(w.serviceFee || 0), 0), [paidWithdrawals]);

  const monthly = useMemo(() => {
    const map: Record<string, any> = {};
    paid.forEach((p: any) => {
      const k = monthKey(p.paidAt || p.updatedAt || p.createdAt);
      if (!k) return;
      map[k] ??= { gross: 0, gatewayFees: 0, tutorAllocated: 0, withdrawals: 0, withdrawalFees: 0, transactions: 0 };
      map[k].gross += Number(p.customerTotal || Number(p.amount || 0) / 100);
      map[k].gatewayFees += Number(p.transactionFee || 0);
      map[k].tutorAllocated += p.tutorId ? Number(p.baseAmount || 0) : 0;
      map[k].transactions++;
    });
    paidWithdrawals.forEach((w: any) => {
      const k = monthKey(w.paidAt || w.updatedAt || w.createdAt);
      if (!k) return;
      map[k] ??= { gross: 0, gatewayFees: 0, tutorAllocated: 0, withdrawals: 0, withdrawalFees: 0, transactions: 0 };
      map[k].withdrawals += Number(w.netAmount || 0);
      map[k].withdrawalFees += Number(w.serviceFee || 0);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([month, v]) => ({
      month,
      ...v,
      platformRevenue: v.gatewayFees + v.withdrawalFees
    }));
  }, [paid, paidWithdrawals]);

  const editPlan = (p: Plan) => {
    setSelectedPlan(p.id);
    setPlanDraft({
      name: p.name || '',
      baseAmount: String(p.baseAmount ?? ''),
      durationWeeks: String(p.durationWeeks ?? ''),
      teachingModes: Array.isArray(p.teachingModes) ? p.teachingModes.join(', ') : ''
    });
  };

  const savePlan = async () => {
    if (!selectedPlan) return;
    setSaving('plan');
    try {
      await billingPost('billing-admin', {
        action: 'update_plan',
        planId: selectedPlan,
        name: planDraft.name,
        baseAmount: Number(planDraft.baseAmount),
        durationWeeks: Number(planDraft.durationWeeks),
        teachingModes: planDraft.teachingModes.split(',').map(s => s.trim()).filter(Boolean)
      });
      toast.success('Payment plan updated.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to save plan.');
    } finally {
      setSaving('');
    }
  };

  const saveFee = async (policyRole: 'parent' | 'school', policy: Policy) => {
    setSaving(policyRole);
    try {
      await billingPost('billing-admin', {
        action: 'update_fee_policy',
        role: policyRole,
        percentage: Number(policy.percentage),
        flat: Number(policy.flat),
        cap: Number(policy.cap),
        waiveFlatBelow: Number(policy.waiveFlatBelow),
        enabled: policy.enabled
      });
      toast.success('Transaction fee policy updated.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to save fee policy.');
    } finally {
      setSaving('');
    }
  };

  const saveWithdrawalFee = async () => {
    setSaving('withdrawal-fee');
    try {
      await billingPost('billing-admin', {
        action: 'set_withdrawal_fee_policy',
        percentage: Number(withdrawalPolicy.percentage),
        flat: Number(withdrawalPolicy.flat),
        cap: Number(withdrawalPolicy.cap),
        enabled: withdrawalPolicy.enabled
      });
      toast.success('Withdrawal service fee updated.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to save withdrawal fee.');
    } finally {
      setSaving('');
    }
  };

  const saveMinimum = async () => {
    setSaving('minimum');
    try {
      await billingPost('billing-admin', {
        action: 'set_minimum_withdrawal',
        amount: Number(minimumWithdrawal)
      });
      toast.success('Minimum withdrawal updated.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to save withdrawal rule.');
    } finally {
      setSaving('');
    }
  };

  const assignTutor = async (payment: any, tutorId: string) => {
    if (!tutorId) return;
    setSaving(payment.id);
    try {
      await billingPost('billing-admin', {
        action: 'assign_tutor',
        paymentId: payment.id,
        studentId: payment.studentId || '',
        tutorId
      });
      toast.success('Tutor assigned and wallet allocation recorded.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to assign tutor.');
    } finally {
      setSaving('');
    }
  };

  const saveSchoolQuickBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchoolBilling) return;
    setSaving('school-quick');
    try {
      await billingPost('billing-admin', {
        action: 'set_school_billing',
        schoolId: editingSchoolBilling.id,
        baseAmount: Number(editingSchoolBilling.billing?.baseAmount || 300000),
        cycle: editingSchoolBilling.billing?.cycle || 'termly',
        mode: editingSchoolBilling.billing?.mode || 'advance_termly',
        nextDueDate: editingSchoolBilling.billing?.nextDueDate || '',
        notes: editingSchoolBilling.billing?.notes || ''
      });

      await setDoc(doc(db, 'schools', editingSchoolBilling.id), {
        billing: editingSchoolBilling.billing,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast.success(`Billing updated for ${editingSchoolBilling.name}`);
      setEditingSchoolBilling(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update school billing.');
    } finally {
      setSaving('');
    }
  };

  const sendSchoolReminder = async (school: any) => {
    setSaving(`reminder-${school.id}`);
    try {
      await billingPost('billing-admin', {
        action: 'send_payment_reminder',
        targetType: 'SCHOOL',
        targetId: school.id,
        recipientId: school.adminUid || school.id,
        email: school.contactEmail || school.email,
        amount: school.billing?.baseAmount || 300000,
        nextDueDate: school.billing?.nextDueDate,
        title: `Tuition & Lab Subscription Due - ${school.name}`
      });

      toast.success(`Payment reminder issued to ${school.name}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to dispatch payment reminder.');
    } finally {
      setSaving('');
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center items-center text-xs text-slate-500 gap-2">
        <Loader2 className="animate-spin" size={18} /> Loading billing operations...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO title="Billing & Wallet Operations | Admin" description="Manage payment plans, fees, transactions and staff wallet allocations." noindex={true} />

      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-brand-red font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={14} /> Financial Operations
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1.5">
              Billing, Invoicing & Financial Operations
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Verified Paystack collections, partner school invoicing, tutor allocations, and customer fee policies.
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => void load()} 
            className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all inline-flex items-center gap-2"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric icon={<DollarSign className="text-emerald-500" size={20} />} label="Gross Collections" value={money(totalGross)} />
        <Metric icon={<Activity className="text-blue-500" size={20} />} label="Paystack Fees" value={money(totalFees)} />
        <Metric icon={<Users className="text-brand-red" size={20} />} label="Tutor Allocations" value={money(tutorAllocated)} />
        <Metric icon={<Wallet className="text-purple-500" size={20} />} label="Withdrawal Fees" value={money(withdrawalFees)} />
        <Metric icon={<TrendingUp className="text-amber-500" size={20} />} label="Platform Net" value={money(totalFees + withdrawalFees)} />
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Financial Summary & Payments', icon: <TrendingUp size={15} /> },
          { id: 'schools', label: `Partner School Billings (${schools.length})`, icon: <School size={15} /> },
          { id: 'policies', label: 'Fee Policies & Plans', icon: <CreditCard size={15} /> }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`min-h-10 px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === tab.id
                ? 'bg-brand-red text-white shadow-sm shadow-red-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Overview & Payments */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Monthly Summary Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h2 className="font-black text-base text-slate-900 dark:text-white mb-4">Monthly Financial Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-black text-[10px]">
                    <th className="p-3 text-left">Month</th>
                    <th className="p-3 text-left">Transactions</th>
                    <th className="p-3 text-left">Gross</th>
                    <th className="p-3 text-left">Gateway Fees</th>
                    <th className="p-3 text-left">Tutor Allocations</th>
                    <th className="p-3 text-left">Staff Payouts</th>
                    <th className="p-3 text-left">Platform Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {monthly.length ? (
                    monthly.map((m: any) => (
                      <tr key={m.month}>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{m.month}</td>
                        <td className="p-3">{m.transactions}</td>
                        <td className="p-3 font-mono">{money(m.gross)}</td>
                        <td className="p-3 font-mono">{money(m.gatewayFees)}</td>
                        <td className="p-3 font-mono">{money(m.tutorAllocated)}</td>
                        <td className="p-3 font-mono">{money(m.withdrawals)}</td>
                        <td className="p-3 font-mono font-black text-brand-red">{money(m.platformRevenue)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">No financial records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verified Payments Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h2 className="font-black text-base text-slate-900 dark:text-white mb-4">Verified Invoices & Tutor Allocation</h2>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-black text-[10px]">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Plan / Purpose</th>
                    <th className="p-3 text-left">Target Cadet / School</th>
                    <th className="p-3 text-left">Base</th>
                    <th className="p-3 text-left">Customer Total</th>
                    <th className="p-3 text-left">Assigned Tutor</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paid.length ? (
                    paid.map((p: any) => (
                      <tr key={p.id}>
                        <td className="p-3 text-slate-500">{dateLabel(p.paidAt)}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">{p.plan || p.paymentPlanName || 'Subscription'}</div>
                          <div className="text-[10px] font-mono text-slate-400">{p.reference}</div>
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {p.studentName || p.enrollmentStudentName || 'Institutional Account'}
                        </td>
                        <td className="p-3 font-mono">{money(p.baseAmount)}</td>
                        <td className="p-3 font-mono font-black text-brand-red">
                          {money(p.customerTotal || Number(p.amount || 0) / 100)}
                        </td>
                        <td className="p-3">{p.tutorName || 'Unassigned'}</td>
                        <td className="p-3">
                          {p.tutorId ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                              <CheckCircle2 size={13} /> Assigned
                            </span>
                          ) : (
                            <select 
                              defaultValue="" 
                              disabled={saving === p.id} 
                              onChange={e => void assignTutor(p, e.target.value)} 
                              className="min-h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px]"
                            >
                              <option value="">Assign Tutor</option>
                              {(data.staff || []).filter((s: any) => ['tutor', 'staff'].includes(String(s.role).toLowerCase())).map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">No verified payments yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Partner School Billings & Reminders */}
      {activeTab === 'schools' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">Partner School Custom Billing Management</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set custom institutional fees (₦ NGN), payment cycles (Monthly / Termly), payment modes, and dispatch one-click renewal reminders.
                </p>
              </div>
            </div>

            {/* Quick edit drawer / modal */}
            {editingSchoolBilling && (
              <div className="mb-6 p-6 rounded-3xl bg-slate-50 dark:bg-slate-950/60 border-2 border-brand-red/30 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Edit Billing for {editingSchoolBilling.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingSchoolBilling(null)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={saveSchoolQuickBilling} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fee Amount (₦)</label>
                    <input
                      type="number"
                      required
                      value={editingSchoolBilling.billing?.baseAmount || 300000}
                      onChange={e => setEditingSchoolBilling({
                        ...editingSchoolBilling,
                        billing: { ...(editingSchoolBilling.billing || {}), baseAmount: Number(e.target.value) }
                      })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Billing Cycle</label>
                    <select
                      value={editingSchoolBilling.billing?.cycle || 'termly'}
                      onChange={e => setEditingSchoolBilling({
                        ...editingSchoolBilling,
                        billing: { ...(editingSchoolBilling.billing || {}), cycle: e.target.value }
                      })}
                      className={inputClass}
                    >
                      <option value="termly">Termly (12 Weeks)</option>
                      <option value="monthly">Monthly (4 Weeks)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Default Mode</label>
                    <select
                      value={editingSchoolBilling.billing?.mode || 'advance_termly'}
                      onChange={e => setEditingSchoolBilling({
                        ...editingSchoolBilling,
                        billing: { ...(editingSchoolBilling.billing || {}), mode: e.target.value }
                      })}
                      className={inputClass}
                    >
                      <option value="advance_termly">Advance Termly</option>
                      <option value="advance_monthly">Advance Monthly</option>
                      <option value="post_termly">Post Termly</option>
                      <option value="post_monthly">Post Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Next Due Date</label>
                    <input
                      type="date"
                      value={editingSchoolBilling.billing?.nextDueDate || ''}
                      onChange={e => setEditingSchoolBilling({
                        ...editingSchoolBilling,
                        billing: { ...(editingSchoolBilling.billing || {}), nextDueDate: e.target.value }
                      })}
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-4 flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingSchoolBilling(null)}
                      className="min-h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving === 'school-quick'}
                      className="min-h-10 px-5 rounded-xl bg-brand-red text-white text-xs font-black inline-flex items-center gap-1.5"
                    >
                      {saving === 'school-quick' ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                      Save Billing
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-black text-[10px]">
                    <th className="py-3 px-3">School Name</th>
                    <th className="py-3 px-3">Undergoing Programmes</th>
                    <th className="py-3 px-3">Configured Fee (₦)</th>
                    <th className="py-3 px-3">Cycle & Mode</th>
                    <th className="py-3 px-3">Next Due Date</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {schools.map(sch => {
                    const progCount = sch.programs?.length || 0;
                    const baseFee = sch.billing?.baseAmount || 300000;
                    const cycle = sch.billing?.cycle || 'termly';
                    const mode = sch.billing?.mode || 'advance_termly';
                    const nextDueDate = sch.billing?.nextDueDate;

                    return (
                      <tr key={sch.id}>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{sch.name}</div>
                          <div className="text-[11px] text-slate-400">{sch.contactEmail || sch.email}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-50 text-brand-red dark:bg-red-950/40">
                            {progCount} Active
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-black text-slate-900 dark:text-white">
                          {formatNaira(baseFee)}
                        </td>
                        <td className="py-3.5 px-3 capitalize text-slate-600 dark:text-slate-400">
                          {cycle} • {mode.replace('_', ' ')}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400">
                          {nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-NG') : '—'}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingSchoolBilling(sch)}
                              className="min-h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold flex items-center gap-1"
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              disabled={saving === `reminder-${sch.id}`}
                              onClick={() => void sendSchoolReminder(sch)}
                              className="min-h-8 px-3 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-[11px] font-black inline-flex items-center gap-1"
                            >
                              {saving === `reminder-${sch.id}` ? <Loader2 className="animate-spin" size={13} /> : <Send size={13} />}
                              Send Reminder
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Fee Policies & Plans */}
      {activeTab === 'policies' && role === 'superadmin' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PolicyCard 
              title="Parent Transaction Fee Policy" 
              policy={parentPolicy} 
              setPolicy={setParentPolicy} 
              saving={saving === 'parent'} 
              onSave={() => void saveFee('parent', parentPolicy)} 
            />
            <PolicyCard 
              title="School Transaction Fee Policy" 
              policy={schoolPolicy} 
              setPolicy={setSchoolPolicy} 
              saving={saving === 'school'} 
              onSave={() => void saveFee('school', schoolPolicy)} 
            />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h2 className="font-black text-base text-slate-900 dark:text-white">Staff Withdrawal Service Fee</h2>
            <p className="text-xs text-slate-500 mt-1">Deducted from tutor gross withdrawal before payout.</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
              <input type="number" step="0.01" value={withdrawalPolicy.percentage} onChange={e => setWithdrawalPolicy({ ...withdrawalPolicy, percentage: e.target.value })} placeholder="Percent %" className={inputClass} />
              <input type="number" value={withdrawalPolicy.flat} onChange={e => setWithdrawalPolicy({ ...withdrawalPolicy, flat: e.target.value })} placeholder="Flat fee (₦)" className={inputClass} />
              <input type="number" value={withdrawalPolicy.cap} onChange={e => setWithdrawalPolicy({ ...withdrawalPolicy, cap: e.target.value })} placeholder="Fee Cap (₦)" className={inputClass} />
              <label className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-3 flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={withdrawalPolicy.enabled} onChange={e => setWithdrawalPolicy({ ...withdrawalPolicy, enabled: e.target.checked })} />
                Enable Fee
              </label>
            </div>
            <button disabled={saving === 'withdrawal-fee'} onClick={() => void saveWithdrawalFee()} className="min-h-11 mt-4 rounded-xl bg-slate-900 hover:bg-black text-white px-5 text-xs font-black inline-flex items-center gap-2">
              <Save size={14} /> {saving === 'withdrawal-fee' ? 'Saving…' : 'Save Withdrawal Fee Policy'}
            </button>
          </div>

          {/* Standard Plans Editor */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h2 className="font-black text-base text-slate-900 dark:text-white mb-4">Default Standard Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map(plan => (
                <div key={plan.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <h3 className="font-black text-sm">{plan.name}</h3>
                  <div className="text-xs text-slate-500 mt-1">{plan.role} • {plan.durationWeeks} weeks</div>
                  <div className="text-xl font-black font-mono mt-2">{money(plan.baseAmount)}</div>
                  <button type="button" onClick={() => editPlan(plan)} className="min-h-9 mt-3 rounded-xl border border-slate-200 px-3 text-xs font-bold">
                    Edit Plan
                  </button>
                </div>
              ))}
            </div>

            {selectedPlan && (
              <div className="mt-6 p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider mb-3">Edit Plan: {selectedPlan}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={planDraft.name} onChange={e => setPlanDraft({ ...planDraft, name: e.target.value })} placeholder="Plan Name" className={inputClass} />
                  <input type="number" value={planDraft.baseAmount} onChange={e => setPlanDraft({ ...planDraft, baseAmount: e.target.value })} placeholder="Base Amount (₦)" className={inputClass} />
                  <input type="number" value={planDraft.durationWeeks} onChange={e => setPlanDraft({ ...planDraft, durationWeeks: e.target.value })} placeholder="Duration Weeks" className={inputClass} />
                  <input value={planDraft.teachingModes} onChange={e => setPlanDraft({ ...planDraft, teachingModes: e.target.value })} placeholder="Teaching Modes (comma separated)" className={inputClass} />
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => setSelectedPlan('')} className="min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold">Close</button>
                  <button disabled={saving === 'plan'} onClick={() => void savePlan()} className="min-h-10 px-5 rounded-xl bg-brand-red text-white text-xs font-black inline-flex items-center gap-1">
                    <Save size={14} /> {saving === 'plan' ? 'Saving…' : 'Save Plan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
    <div>{icon}</div>
    <div className="text-xs text-slate-500 mt-3">{label}</div>
    <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{value}</div>
  </div>
);

const PolicyCard = ({ title, policy, setPolicy, saving, onSave }: { title: string; policy: Policy; setPolicy: (p: Policy) => void; saving: boolean; onSave: () => void }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
    <h2 className="font-black text-base text-slate-900 dark:text-white">{title}</h2>
    <p className="text-xs text-slate-500 mt-0.5">Passed through to customer at Paystack checkout.</p>
    <div className="grid grid-cols-2 gap-3 mt-4">
      <input type="number" step="0.01" value={policy.percentage} onChange={e => setPolicy({ ...policy, percentage: e.target.value })} placeholder="Percent %" className={inputClass} />
      <input type="number" value={policy.flat} onChange={e => setPolicy({ ...policy, flat: e.target.value })} placeholder="Flat Fee (₦)" className={inputClass} />
      <input type="number" value={policy.cap} onChange={e => setPolicy({ ...policy, cap: e.target.value })} placeholder="Fee Cap (₦)" className={inputClass} />
      <input type="number" value={policy.waiveFlatBelow || ''} onChange={e => setPolicy({ ...policy, waiveFlatBelow: e.target.value })} placeholder="Waive Below (₦)" className={inputClass} />
    </div>
    <button disabled={saving} type="button" onClick={onSave} className="min-h-11 mt-4 rounded-xl bg-brand-red text-white px-5 text-xs font-black inline-flex items-center gap-2 shadow-sm">
      <Save size={14} /> {saving ? 'Saving…' : 'Save Fee Policy'}
    </button>
  </div>
);

export default AdminBilling;
