import React, { useEffect, useMemo, useState } from 'react';
import { 
  Banknote, CheckCircle2, CreditCard, Download, 
  Loader2, RefreshCw, ShieldCheck, Wallet, X, 
  Building2, Smartphone, BookOpen, 
  School, Check, Bell, UserCheck
} from 'lucide-react';
import jsPDF from 'jspdf';
import { billingGet, billingPost, dateLabel, feeFromBase, formatNaira } from '../../lib/billing';
import { useToast } from '../../contexts/ToastContext';
import SEO from '../../components/ui/SEO';

export type BillingCenterRole = 'student' | 'parent' | 'staff' | 'school';
type PaymentRecord = Record<string, any> & { id: string };
type Plan = { 
  id: string; 
  name: string; 
  baseAmount: number; 
  durationWeeks: number; 
  teachingModes: string[]; 
  description: string; 
  active: boolean; 
  role: string 
};
type PaymentMethod = 'card' | 'bank_transfer' | 'opay';

const dueDateFor = (payment?: PaymentRecord) => { 
  if (!payment?.paidAt) return null; 
  const date = new Date(payment.paidAt); 
  date.setDate(date.getDate() + Number(payment.durationWeeks || 4) * 7); 
  return date; 
};

const methodLabel = (method: PaymentMethod) => 
  method === 'card' ? 'Card' : method === 'bank_transfer' ? 'Bank Transfer' : 'OPay / Mobile Money';

const PaymentTable: React.FC<{ payments: PaymentRecord[]; onReceipt: (p: PaymentRecord) => void }> = ({ payments, onReceipt }) => (
  <div className="overflow-x-auto">
    <table className="min-w-[1000px] w-full text-left text-xs">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-800">
          {['Date', 'Plan / Purpose', 'Mode', 'Duration', 'Paid Through', 'Source', 'Base Amount', 'Gateway Fee', 'Total Paid', 'Reference', ''].map(h => (
            <th key={h} className="px-3 py-3 font-black uppercase tracking-wider text-slate-500">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {payments.map(payment => (
          <tr key={payment.id}>
            <td className="px-3 py-4 whitespace-nowrap">{dateLabel(payment.paidAt || payment.createdAt)}</td>
            <td className="px-3 py-4">
              <div className="font-bold">{payment.plan || payment.paymentPlanName || 'Tuition / Lab Subscription'}</div>
              <div className="text-slate-500">{payment.studentName || 'Institutional Account'}</div>
            </td>
            <td className="px-3 py-4">{payment.teachingMode || 'Standard Delivery'}</td>
            <td className="px-3 py-4">{payment.durationWeeks || 4} weeks</td>
            <td className="px-3 py-4 whitespace-nowrap font-bold">{payment.paidThrough ? dateLabel(payment.paidThrough) : '—'}</td>
            <td className="px-3 py-4"><span className="inline-flex px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">{payment.paymentSource || payment.escrowQuarter || "This Quarter's Escrow Account"}</span></td>
            <td className="px-3 py-4 font-mono">{formatNaira(payment.baseAmount || 0)}</td>
            <td className="px-3 py-4 font-mono">{formatNaira(payment.transactionFee || 0)}</td>
            <td className="px-3 py-4 font-mono font-black text-brand-red">
              {formatNaira(payment.customerTotal || Number(payment.amount || 0) / 100)}
            </td>
            <td className="px-3 py-4 font-mono text-[10px] text-slate-400">{payment.reference || payment.id}</td>
            <td className="px-3 py-4 text-right">
              <button 
                type="button" 
                onClick={() => onReceipt(payment)} 
                className="min-h-9 rounded-xl border border-slate-200 dark:border-slate-700 px-3 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all inline-flex items-center gap-1 text-[11px]"
              >
                <Download size={13} /> Receipt
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const BillingCenter: React.FC<{ role: BillingCenterRole }> = ({ role }) => {
  const { toast } = useToast();
  const [data, setData] = useState<any>({ 
    payments: [], 
    students: [], 
    withdrawals: [], 
    wallet: {}, 
    config: { plans: {}, parentFeePolicy: {}, schoolFeePolicy: {} },
    isExempt: false,
    managedBy: null,
    managerName: null,
    schoolPrograms: [],
    schoolBilling: null,
    schoolInfo: null
  });
  const [loading, setLoading] = useState(true); 
  const [selectedStudentId, setSelectedStudentId] = useState(''); 
  const [selectedPlanId, setSelectedPlanId] = useState(''); 
  const [selectedMode, setSelectedMode] = useState('advance_termly');
  const [teachingMode, setTeachingMode] = useState(''); 
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card'); 
  const [showCheckout, setShowCheckout] = useState(false); 
  const [paying, setPaying] = useState(false);

  // Staff wallet
  const [withdrawalAmount, setWithdrawalAmount] = useState(''); 
  const [bankCode, setBankCode] = useState(''); 
  const [accountNumber, setAccountNumber] = useState(''); 
  const [banks, setBanks] = useState<any[]>([]); 
  const [savingBank, setSavingBank] = useState(false); 
  const [withdrawing, setWithdrawing] = useState(false);

  const load = async () => { 
    setLoading(true); 
    try { 
      const result = await billingGet<any>('billing-data');
      setData(result);
      if (result.schoolBilling?.mode) {
        setSelectedMode(result.schoolBilling.mode);
      }
    } catch (error) { 
      toast.error(error instanceof Error ? error.message : 'Unable to load billing data.'); 
    } finally { 
      setLoading(false); 
    } 
  };

  useEffect(() => { 
    void load(); 
  }, []);

  useEffect(() => { 
    if (role === 'staff') {
      billingGet<any>('paystack-banks').then(result => setBanks(result.banks || [])).catch(() => undefined);
    }
  }, [role]);

  useEffect(() => { 
    const reference = new URLSearchParams(window.location.search).get('reference'); 
    if (!reference) return; 
    billingPost<any>('paystack-verify', { reference }).then(() => { 
      toast.success('Payment verified successfully.'); 
      window.history.replaceState({}, document.title, window.location.pathname); 
      void load(); 
    }).catch(error => toast.error(error instanceof Error ? error.message : 'Payment verification failed.')); 
  }, []);

  // Filter plans based on role
  const standardPlans = useMemo(() => {
    return Object.values((data.config?.plans || {}) as Record<string, Plan>)
      .filter(p => p?.active && ((role === 'school' && p.role === 'school') || (role !== 'school' && p.role !== 'school')));
  }, [data.config, role]);

  const feePolicy = role === 'school' ? data.config?.schoolFeePolicy : data.config?.parentFeePolicy;

  // Active School custom billing
  const schoolBilling = data.schoolBilling;
  const schoolPrograms = data.schoolPrograms || data.schoolInfo?.programs || [];
  const schoolFee = Number(schoolBilling?.baseAmount || 350000);
  const schoolCycle = schoolBilling?.cycle || 'termly';
  const allowedSchoolModes = schoolBilling?.allowedModes || ['advance_termly', 'advance_monthly', 'post_termly', 'post_monthly'];

  // Payments
  const payments = useMemo(() => {
    return (data.payments || [])
      .filter((p: PaymentRecord) => String(p.status || '').toUpperCase() === 'PAID')
      .sort((a: PaymentRecord, b: PaymentRecord) => new Date(b.paidAt || b.createdAt || 0).getTime() - new Date(a.paidAt || a.createdAt || 0).getTime());
  }, [data.payments]);

  const dueDate = dueDateFor(payments[0]);

  // Start checkout handler
  const startCheckout = (opts?: { plan?: Plan; studentId?: string; planName?: string }) => {
    if (role === 'school') {
      setSelectedPlanId('custom_school_billing');
      setTeachingMode('Standard Institutional Lab Delivery');
    } else {
      const targetPlan = opts?.plan || standardPlans[0];
      if (!targetPlan) return;
      setSelectedPlanId(targetPlan.id);
      setSelectedStudentId(opts?.studentId || selectedStudentId || data.students?.[0]?.id || '');
      setTeachingMode(targetPlan.teachingModes?.[0] || 'Standard Delivery');
    }
    setPaymentMethod('card');
    setShowCheckout(true);
  };

  const processPayment = async (event: React.FormEvent) => { 
    event.preventDefault(); 
    if (role === 'parent' && !selectedStudentId) { 
      toast.error('Please select the child this payment is for.'); 
      return; 
    } 
    setPaying(true); 
    try { 
      const checkoutPayload: Record<string, any> = {
        role,
        paymentMethod,
        teachingMode: teachingMode || 'Standard Delivery'
      };

      if (role === 'school') {
        checkoutPayload.amount = schoolFee;
        checkoutPayload.planId = 'school_custom_fee';
        checkoutPayload.planName = `Institutional Lab Fee - ${data.schoolInfo?.name || 'Partner School'}`;
        checkoutPayload.cycle = schoolCycle;
        checkoutPayload.paymentMode = selectedMode;
        checkoutPayload.durationWeeks = schoolCycle === 'monthly' ? 4 : 12;
      } else {
        const plan = standardPlans.find(p => p.id === selectedPlanId) || standardPlans[0];
        checkoutPayload.planId = plan ? plan.id : 'parent_tuition';
        checkoutPayload.studentId = selectedStudentId || undefined;
        checkoutPayload.durationWeeks = 4;
      }

      const result = await billingPost<any>('paystack-initialize', checkoutPayload); 
      window.location.assign(result.authorizationUrl); 
    } catch (error) { 
      toast.error(error instanceof Error ? error.message : 'Unable to start checkout.'); 
    } finally { 
      setPaying(false); 
    } 
  };

  const receipt = (payment: PaymentRecord) => { 
    const pdf = new jsPDF(); 
    const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date(); 
    pdf.setFont('helvetica', 'bold'); 
    pdf.setFontSize(18); 
    pdf.text('JAYSTARBLISS STUDIOS', 20, 24); 
    pdf.setFontSize(13); 
    pdf.text('Official Payment Receipt', 20, 35); 
    pdf.setFont('helvetica', 'normal'); 
    pdf.setFontSize(10); 
    [
      `Reference: ${payment.reference || payment.id}`,
      `Date paid: ${paidAt.toLocaleString('en-NG')}`,
      `Student / Account: ${payment.studentName || data.schoolInfo?.name || 'Account'}`,
      `Plan: ${payment.plan || payment.paymentPlanName || 'Tuition / Lab Subscription'}`,
      `Teaching mode: ${payment.teachingMode || 'Standard Delivery'}`,
      `Duration: ${payment.durationWeeks || 4} weeks`,
      `Base fee: ${formatNaira(payment.baseAmount)}`,
      `Paystack transaction fee: ${formatNaira(payment.transactionFee)}`,
      `Customer total: ${formatNaira(payment.customerTotal || Number(payment.amount || 0) / 100)}`,
      `Payment method: ${payment.paymentMethod || 'Paystack'}`,
      `Payment source: ${payment.paymentSource || payment.escrowQuarter || "This Quarter's Escrow Account"}`,
      `Paid through: ${payment.paidThrough ? new Date(payment.paidThrough).toLocaleDateString('en-NG', { dateStyle: 'long' }) : '—'}`
    ].forEach((line, index) => pdf.text(line, 20, 55 + index * 10)); 
    pdf.save(`jaystarbliss-receipt-${payment.reference || payment.id}.pdf`); 
  };

  const saveBank = async (event: React.FormEvent) => { 
    event.preventDefault(); 
    setSavingBank(true); 
    try { 
      await billingPost('wallet-withdraw', { action: 'save_bank', bankCode, accountNumber }); 
      toast.success('Verified bank account saved.'); 
      await load(); 
    } catch (error) { 
      toast.error(error instanceof Error ? error.message : 'Unable to verify bank account.'); 
    } finally { 
      setSavingBank(false); 
    } 
  };

  const withdraw = async (event: React.FormEvent) => { 
    event.preventDefault(); 
    setWithdrawing(true); 
    try { 
      await billingPost('wallet-withdraw', { action: 'withdraw', amount: Number(withdrawalAmount) }); 
      toast.success('Withdrawal submitted.'); 
      setWithdrawalAmount(''); 
      await load(); 
    } catch (error) { 
      toast.error(error instanceof Error ? error.message : 'Unable to submit withdrawal.'); 
    } finally { 
      setWithdrawing(false); 
    } 
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center items-center text-xs text-slate-500 gap-2">
        <Loader2 className="animate-spin" size={18} /> Loading billing workspace…
      </div>
    );
  }

  // 1. CONDITIONAL VIEW: Student registered by School or Parent (EXEMPT)
  if (role === 'student' && data.isExempt) {
    return (
      <section className="space-y-6" aria-label="Billing center">
        <SEO title="Student Billing & Curriculum Status | Jaystarbliss Studios" description="Sponsored student status" noindex={true} />
        
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <UserCheck size={16} /> Sponsored Enrollment Status
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-2">
            Institutional & Family Sponsorship
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl">
            Your laboratory access, CBT assessments, and STEM curriculum are fully covered by your institution or parent.
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 dark:from-emerald-950/20 dark:via-slate-900 dark:to-teal-950/10 border border-emerald-200/80 dark:border-emerald-800/60 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="min-w-12 min-h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                No Individual Billing Required
              </h2>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed max-w-3xl">
                Your account is linked to <strong className="text-emerald-700 dark:text-emerald-400 font-black">{data.managerName || (data.managedBy === 'school' ? 'your partner school' : 'your parent / guardian')}</strong>. 
                All program subscriptions, learning resources, and hands-on lab sessions are centrally administered. 
                Enjoy your learning journey!
              </p>

              <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-emerald-100 dark:border-emerald-900/40 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Curriculum Access:</span>
                  <span className="font-bold text-emerald-600 bg-emerald-100/60 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full">
                    Active & Unlimited
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">CBT & Practical Exams:</span>
                  <span className="font-bold text-emerald-600 bg-emerald-100/60 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full">
                    Passcode Enabled
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // 2. SCHOOL PORTAL: Admin-Controlled Dynamic Billing
  if (role === 'school') {
    const chargePreview = feeFromBase(schoolFee, feePolicy);
    const hasReminder = Boolean(schoolBilling?.lastReminderSentAt || schoolBilling?.status === 'DUE');

    return (
      <section className="space-y-6" aria-label="School billing center">
        <SEO title="School Lab & Tuition Billing | Jaystarbliss Studios" description="Institutional STEM lab billing." noindex={true} />

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-red">
                <School size={15} /> Partner School Billing Portal
              </div>
              <h1 className="mt-1.5 text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                Institutional Subscription & Lab Fees
              </h1>
              <p className="mt-1 text-xs md:text-sm text-slate-500">
                Transparent pricing configured directly by Jaystarbliss Studios administration.
              </p>
            </div>
            <button 
              type="button" 
              onClick={() => void load()} 
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Due date notice if applicable */}
        {hasReminder && (
          <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
            <Bell className="text-amber-600 mt-0.5 flex-shrink-0" size={18} />
            <div>
              <strong className="font-black text-sm block">Payment Renewal Notice</strong>
              <span className="mt-1 block leading-relaxed">
                Your institutional lab subscription is scheduled for renewal. 
                {schoolBilling?.nextDueDate && ` Scheduled Due Date: ${new Date(schoolBilling.nextDueDate).toLocaleDateString('en-NG', { dateStyle: 'long' })}.`}
              </span>
            </div>
          </div>
        )}

        {/* Undergoing Programmes Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Undergoing Programmes & Laboratory Scope
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Active STEM curriculum and hands-on tracks undergoing at your institution.
              </p>
            </div>
            <BookOpen className="text-brand-red" size={20} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schoolPrograms.length ? (
              schoolPrograms.map((prog: any) => (
                <div 
                  key={prog.id || prog.name} 
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between"
                >
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-brand-red dark:bg-red-950/40">
                      {prog.status || 'ACTIVE'}
                    </span>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white mt-2">
                      {prog.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                      {prog.description}
                    </p>
                  </div>
                  {prog.schedule && (
                    <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500">
                      <strong>Schedule:</strong> {prog.schedule}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-2 text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                No individual programs itemized. Standard STEM curriculum active.
              </div>
            )}
          </div>
        </div>

        {/* Dynamic School Billing Fee Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-brand-red">
                  Admin-Configured Institutional Fee
                </span>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {formatNaira(schoolFee)} <span className="text-xs text-slate-400 font-normal">/ {schoolCycle === 'monthly' ? 'Month (4 Weeks)' : 'Term (12 Weeks)'}</span>
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {schoolCycle === 'monthly' ? '4 Weeks Cycle' : '12 Weeks Term'}
              </span>
            </div>

            {/* Mode of Payment Selector */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                Select Mode of Payment
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { id: 'advance_termly', label: 'Advance Termly', desc: 'Pay upfront for the entire 12-week term.' },
                  { id: 'advance_monthly', label: 'Advance Monthly', desc: 'Pay upfront for 4 weeks of STEM lab access.' },
                  { id: 'post_termly', label: 'Post Termly', desc: 'Settle institutional invoice at end of term.' },
                  { id: 'post_monthly', label: 'Post Monthly', desc: 'Settle institutional invoice at end of month.' }
                ]
                  .filter(m => allowedSchoolModes.includes(m.id))
                  .map(modeOpt => (
                    <div
                      key={modeOpt.id}
                      onClick={() => setSelectedMode(modeOpt.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        selectedMode === modeOpt.id
                          ? 'border-brand-red bg-red-50/50 dark:bg-red-950/20 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span>{modeOpt.label}</span>
                        {selectedMode === modeOpt.id && <Check size={14} className="text-brand-red" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{modeOpt.desc}</p>
                    </div>
                  ))}
              </div>
            </div>

            {/* Price breakdown */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold">Base Fee</span>
                <strong className="text-slate-900 dark:text-white font-mono">{formatNaira(schoolFee)}</strong>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold">Est. Gateway Fee</span>
                <strong className="text-slate-900 dark:text-white font-mono">{formatNaira(chargePreview.transactionFee)}</strong>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold">Est. Total</span>
                <strong className="text-brand-red font-mono font-black">{formatNaira(chargePreview.totalAmount)}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => startCheckout()}
              className="w-full min-h-12 rounded-2xl bg-brand-red hover:bg-red-700 text-white font-black text-xs md:text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <CreditCard size={17} /> Proceed to Paystack Checkout ({formatNaira(schoolFee)})
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Institutional Status</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">School:</span>
                  <span className="font-bold">{data.schoolInfo?.name || 'Partner School'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Latest Verified Payment:</span>
                  <span className="font-bold">{payments[0] ? formatNaira(payments[0].customerTotal || payments[0].baseAmount) : '—'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Next Due Date:</span>
                  <span className="font-black text-brand-red">
                    {schoolBilling?.nextDueDate ? new Date(schoolBilling.nextDueDate).toLocaleDateString('en-NG') : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Payment & Receipt History</h2>
              <p className="text-xs text-slate-500 mt-0.5">Verified Paystack transaction invoices and downloadable PDF receipts.</p>
            </div>
            <Banknote className="text-brand-red" size={20} />
          </div>
          {payments.length ? (
            <PaymentTable payments={payments} onReceipt={receipt} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
              No verified payments recorded yet.
            </div>
          )}
        </div>

        {/* Paystack Checkout Modal */}
        {showCheckout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-brand-red">Paystack Checkout Review</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                    {data.schoolInfo?.name || 'Partner School'} - Lab Subscription
                  </h2>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowCheckout(false)} 
                  className="min-h-9 min-w-9 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={processPayment} className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Institutional Fee</span>
                    <strong className="font-mono">{formatNaira(schoolFee)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estimated Paystack Transaction Fee</span>
                    <strong className="font-mono">{formatNaira(chargePreview.transactionFee)}</strong>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-black">
                    <span>Estimated Total Paid</span>
                    <strong className="text-brand-red font-mono">{formatNaira(chargePreview.totalAmount)}</strong>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200 leading-relaxed">
                  <strong>Important:</strong> The transaction fee is estimated for transparency. Only <strong>{formatNaira(schoolFee)}</strong> is forwarded as the base amount to Paystack so the fee is never charged twice.
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Select Checkout Channel</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['card', 'bank_transfer', 'opay'] as PaymentMethod[]).map(method => (
                      <button 
                        key={method} 
                        type="button" 
                        onClick={() => setPaymentMethod(method)} 
                        className={`min-h-14 rounded-xl border p-2 text-xs font-bold transition-all ${
                          paymentMethod === method 
                            ? 'border-brand-red bg-red-50 text-brand-red dark:bg-red-950/20' 
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {method === 'card' ? <CreditCard className="mx-auto mb-1" size={16} /> : method === 'bank_transfer' ? <Building2 className="mx-auto mb-1" size={16} /> : <Smartphone className="mx-auto mb-1" size={16} />}
                        {methodLabel(method)}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  disabled={paying} 
                  type="submit" 
                  className="min-h-12 w-full rounded-xl bg-brand-red hover:bg-red-700 px-5 text-xs md:text-sm font-black text-white disabled:opacity-50 transition-all shadow-sm"
                >
                  {paying ? <Loader2 className="animate-spin mx-auto" size={18} /> : `Authorize ${methodLabel(paymentMethod)} Checkout`}
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    );
  }

  // 3. DEFAULT/PARENT/STAFF/INDEPENDENT STUDENT BILLING VIEW
  return (
    <section className="space-y-6" aria-label="Billing center">
      <SEO title="Billing Center | Jaystarbliss Studios" description="Payments, plans, receipts and staff wallet." noindex={true} />

      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-red">
              <ShieldCheck size={14} /> Billing Center
            </div>
            <h1 className="mt-1.5 text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
              {role === 'staff' ? 'Tutor Wallet & Payout Operations' : role === 'parent' ? 'Parent Tuition & Payment Plans' : 'Plans & Payments'}
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-500">
              Transparent pricing, Paystack checkout, and verified receipts.
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => void load()} 
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {role !== 'staff' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-slate-500">Latest Payment</p>
            <p className="mt-1 text-xl font-black font-mono text-slate-900 dark:text-white">
              {payments[0] ? formatNaira(payments[0].customerTotal || Number(payments[0].amount || 0) / 100) : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {payments[0] ? dateLabel(payments[0].paidAt) : 'No verified payment yet'}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-slate-500">Paid Through / Access Due</p>
            <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
              {dueDate ? dueDate.toLocaleDateString('en-NG') : 'Active Access'}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-slate-500">Verified Transactions</p>
            <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
              {payments.length} Records
            </p>
          </div>
        </div>
      )}

      {/* Parent / Student Plan Selection */}
      {role !== 'staff' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {role === 'parent' ? 'Select Advance Payment Plan' : 'Choose a Payment Plan'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {role === 'parent' 
                ? 'Parents pay upfront advance tuition (Monthly, Quarterly, or Yearly) with transparent fees.' 
                : 'Select your preferred curriculum track to continue.'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {standardPlans.map(plan => {
              const fee = feeFromBase(plan.baseAmount, feePolicy);
              return (
                <article key={plan.id} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between hover:border-brand-red/40 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-900 dark:text-white text-base">{plan.name}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{plan.description}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-black text-slate-700 dark:text-slate-300">
                        {plan.durationWeeks} weeks
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2 text-xs p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl">
                      <div>
                        <span className="block text-slate-400 text-[10px] font-bold uppercase">Base</span>
                        <strong className="font-mono text-slate-900 dark:text-white">{formatNaira(plan.baseAmount)}</strong>
                      </div>
                      <div>
                        <span className="block text-slate-400 text-[10px] font-bold uppercase">Est. fee</span>
                        <strong className="font-mono text-slate-900 dark:text-white">{formatNaira(fee.transactionFee)}</strong>
                      </div>
                      <div>
                        <span className="block text-slate-400 text-[10px] font-bold uppercase">Est. total</span>
                        <strong className="font-mono text-brand-red font-black">{formatNaira(fee.totalAmount)}</strong>
                      </div>
                    </div>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => startCheckout({ plan })} 
                    className="mt-5 min-h-11 w-full rounded-xl bg-brand-red hover:bg-red-700 px-4 text-xs font-black text-white shadow-sm transition-all"
                  >
                    Continue to Payment ({formatNaira(plan.baseAmount)})
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Staff Wallet View */}
      {role === 'staff' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <Wallet className="text-brand-red" size={24} />
              <div>
                <h2 className="font-black text-base text-slate-900 dark:text-white">Tutor Wallet</h2>
                <p className="text-xs text-slate-500">Verified earnings available for withdrawal.</p>
              </div>
            </div>
            <p className="mt-5 text-3xl font-black font-mono text-brand-red">
              {formatNaira(data.wallet?.availableBalance || 0)}
            </p>

            <form onSubmit={saveBank} className="mt-6 space-y-3">
              <select 
                required 
                value={bankCode} 
                onChange={e => setBankCode(e.target.value)} 
                className="min-h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              >
                <option value="">Select Destination Bank</option>
                {banks.map(bank => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
              </select>
              <input 
                required 
                value={accountNumber} 
                onChange={e => setAccountNumber(e.target.value)} 
                placeholder="10-digit NUBAN account number" 
                className="min-h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              />
              <button 
                disabled={savingBank} 
                className="min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                {savingBank ? 'Verifying…' : 'Verify & Save Bank Account'}
              </button>
            </form>

            <form onSubmit={withdraw} className="mt-5 flex gap-2">
              <input 
                required 
                type="number" 
                min="1000" 
                value={withdrawalAmount} 
                onChange={e => setWithdrawalAmount(e.target.value)} 
                placeholder="Withdrawal Amount (₦)" 
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
              />
              <button 
                disabled={withdrawing} 
                className="min-h-11 rounded-xl bg-brand-red hover:bg-red-700 px-5 text-xs font-black text-white transition-all shadow-sm"
              >
                {withdrawing ? 'Submitting…' : 'Withdraw'}
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="font-black text-base text-slate-900 dark:text-white">Student Payments Linked to Your Teaching</h2>
            <p className="mt-1 text-xs text-slate-500">Reconciled against your assigned students and sessions.</p>
            <div className="mt-5">
              <PaymentTable payments={payments} onReceipt={receipt} />
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      {role !== 'staff' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Payment History</h2>
              <p className="mt-1 text-xs text-slate-500">Verified transactions and downloadable receipts.</p>
            </div>
            <Banknote className="text-brand-red" size={20} />
          </div>
          {payments.length ? (
            <PaymentTable payments={payments} onReceipt={receipt} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
              No verified payments yet.
            </div>
          )}
        </div>
      )}

      {/* Checkout Modal for Parents / Independent Students */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand-red">Paystack Checkout</p>
                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Payment Review</h2>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCheckout(false)} 
                className="min-h-9 min-w-9 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={processPayment} className="mt-6 space-y-4">
              {role === 'parent' && (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-500">Select Child / Student</span>
                  <select 
                    required 
                    value={selectedStudentId} 
                    onChange={e => setSelectedStudentId(e.target.value)} 
                    className="min-h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                  >
                    <option value="">Select Child</option>
                    {(data.students || []).map((student: any) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName || student.studentName || student.username}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-500">Teaching Delivery Mode</span>
                <select 
                  value={teachingMode} 
                  onChange={e => setTeachingMode(e.target.value)} 
                  className="min-h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                >
                  <option value="Physical Lab / In-Person">Physical Lab / In-Person</option>
                  <option value="Online 1-on-1 Mentorship">Online 1-on-1 Mentorship</option>
                  <option value="Hybrid (Lab + Virtual Sessions)">Hybrid (Lab + Virtual Sessions)</option>
                </select>
              </label>

              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['card', 'bank_transfer', 'opay'] as PaymentMethod[]).map(method => (
                    <button 
                      key={method} 
                      type="button" 
                      onClick={() => setPaymentMethod(method)} 
                      className={`min-h-14 rounded-xl border p-2 text-xs font-bold transition-all ${
                        paymentMethod === method 
                          ? 'border-brand-red bg-red-50 text-brand-red dark:bg-red-950/20' 
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {method === 'card' ? <CreditCard className="mx-auto mb-1" size={16} /> : method === 'bank_transfer' ? <Building2 className="mx-auto mb-1" size={16} /> : <Smartphone className="mx-auto mb-1" size={16} />}
                      {methodLabel(method)}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                disabled={paying} 
                type="submit" 
                className="min-h-12 w-full rounded-xl bg-brand-red hover:bg-red-700 px-5 text-xs md:text-sm font-black text-white disabled:opacity-50 transition-all shadow-sm"
              >
                {paying ? <Loader2 className="animate-spin mx-auto" size={18} /> : `Proceed with ${methodLabel(paymentMethod)}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default BillingCenter;
