import React, { useState, useEffect } from 'react';
import { 
  CreditCard, ShieldCheck, CheckCircle2, Download, 
  ArrowRight, FileText, AlertCircle
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { collection, getDocs, getDoc, doc, query, where, limit } from 'firebase/firestore';
import { getClientPaymentConfig } from '../../lib/billing';
import { useToast } from '../../contexts/ToastContext';
import SEO from '../../components/ui/SEO';
import { FintechTransactionHistory } from '../../components/portal/FintechTransactionHistory';
import { getEffectiveAuth, isMasqueradingActive } from '../../utils/impersonation';

interface PaymentRecord {
  id: string;
  amount?: number | string;
  reference?: string;
  plan?: string;
  description?: string;
  paymentMethod?: string;
  status?: string;
  createdAt?: { toDate?: () => Date } | Date | string | null;
}

export const PortalPayments: React.FC = () => {
  const { toast } = useToast();
  const [role, setRole] = useState('student');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer'>('card');
  const [renewalSuccess, setRenewalSuccess] = useState(false);
  const [enrollmentRequestId, setEnrollmentRequestId] = useState('');
  const [, setEnrollmentContext] = useState<{ studentName: string; planId: string } | null>(null);

  useEffect(() => {
    const effective = getEffectiveAuth();
    const userRole = effective.effectiveRole;
    setRole(userRole);

    const requestId = new URLSearchParams(window.location.search).get('enrollmentRequestId') || '';
    setEnrollmentRequestId(requestId);

    const fetchPaymentHistory = async () => {
      setLoading(true);
      try {
        const userUid = effective.effectiveUid || auth.currentUser?.uid;
        const schoolId = effective.effectiveSchoolId || sessionStorage.getItem('schoolId') || '';
        const userEmail = effective.effectiveEmail || auth.currentUser?.email || '';

        const ownedQueries = [];
        if (userUid) {
          ownedQueries.push(query(collection(db, 'payments'), where('userId', '==', userUid), limit(50)));
          ownedQueries.push(query(collection(db, 'payments'), where('parentId', '==', userUid), limit(50)));
          ownedQueries.push(query(collection(db, 'payments'), where('schoolId', '==', userUid), limit(50)));
        }
        if (schoolId && schoolId !== userUid) {
          ownedQueries.push(query(collection(db, 'payments'), where('schoolId', '==', schoolId), limit(50)));
        }
        if (userEmail) {
          ownedQueries.push(query(collection(db, 'payments'), where('email', '==', userEmail), limit(50)));
          ownedQueries.push(query(collection(db, 'payments'), where('parentEmail', '==', userEmail), limit(50)));
        }

        const snapshots = await Promise.all(ownedQueries.map(q => getDocs(q).catch(() => ({ forEach: () => {} } as any))));
        const list: PaymentRecord[] = [];
        const seen = new Set<string>();
        snapshots.forEach((snap: any) => snap.forEach((d: any) => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            list.push({ id: d.id, ...d.data() });
          }
        }));
        list.sort((a, b) => {
          const timestamp = (value: PaymentRecord['createdAt']): number => {
            if (!value) return 0;
            if (typeof value === 'string') return new Date(value).getTime() || 0;
            if (value instanceof Date) return value.getTime();
            if (typeof value.toDate === 'function') return value.toDate().getTime();
            return 0;
          };
          return timestamp(b.createdAt) - timestamp(a.createdAt);
        });

        setPayments(list);
      } catch (err) {
        console.warn('Payments load error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentHistory();
  }, []);

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('reference');
    const verifyReturnedPayment = async () => {
      const user = auth.currentUser;
      if (!reference || !user) return;
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/.netlify/functions/paystack-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ reference })
        });
        const data = await response.json();
        if (!response.ok || !data.verified) throw new Error(data.error || 'Payment verification failed.');
        setRenewalSuccess(true);
        toast.success('Payment verified successfully. Your receipt is now recorded.');
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => setRenewalSuccess(false), 3000);
      } catch (err) {
        console.error('Returned payment verification error:', err);
        toast.error(err instanceof Error ? err.message : 'We could not verify this payment yet.');
      }
    };
    verifyReturnedPayment();
  }, [toast]);

  const isSchool = role.includes('school');

  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadDynamicPlans = async () => {
      try {
        const config = await getClientPaymentConfig();
        const roleKey = isSchool ? 'school' : 'student';
        const fetchedPlans = Object.values(config.plans || {})
          .filter((p: any) => p.role === roleKey && p.active !== false)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            price: `₦${Number(p.baseAmount || 0).toLocaleString()}`,
            period: isSchool ? '/ Term' : '/ Term',
            popular: p.id.includes('mentorship') || p.id.includes('cbt'),
            features: p.teachingModes?.length ? p.teachingModes : [p.description || 'Institutional STEM track']
          }));

        if (!cancelled) {
          setPlans(fetchedPlans);
        }
      } catch (err) {
        console.warn('Error loading dynamic plans:', err);
      }
    };
    void loadDynamicPlans();
    return () => { cancelled = true; };
  }, [isSchool]);

  useEffect(() => {
    if (!enrollmentRequestId || role !== 'parent') return;
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'enrollment_requests', enrollmentRequestId)).then((snap) => {
      if (!snap.exists()) return;
      const request = snap.data();
      if (request.parentId !== user.uid) return;
      const planName = String(request.plan || '').toLowerCase();
      const planId = planName.includes('intensive') ? 'plan_mentorship' : planName.includes('robotics') || planName.includes('ai') ? 'plan_robotics' : 'plan_weekend';
      const matched = plans.find((plan: any) => plan.id === planId);
      if (matched) setSelectedPlan(matched.name);
      setEnrollmentContext({ studentName: String(request.studentName || 'Child'), planId });
    }).catch(() => undefined);
  }, [enrollmentRequestId, role, plans]);

  const handleInitiateRenewal = (planName: string) => {
    if (isMasqueradingActive()) {
      toast.error('Payment checkout is restricted in Admin Impersonation mode. Payments must be processed directly by the client or school.');
      return;
    }
    setSelectedPlan(planName);
    setShowCheckoutModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMasqueradingActive()) {
      toast.error('Payment checkout is restricted in Admin Impersonation mode.');
      return;
    }
    const user = auth.currentUser;
    if (!user || !selectedPlan) {
      toast.error('Please sign in before starting payment.');
      return;
    }

    setRenewing(true);
    try {
      const plan = plans.find(p => p.name === selectedPlan);
      if (!plan) throw new Error('The selected payment plan is no longer available.');

      const idToken = await user.getIdToken();
      const response = await fetch('/.netlify/functions/paystack-initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ planId: plan.id, role, paymentMethod, ...(enrollmentRequestId ? { enrollmentRequestId } : {}) })
      });
      const data = await response.json();
      if (!response.ok || !data.authorizationUrl) {
        throw new Error(data.error || 'Unable to initialize payment.');
      }
      window.location.assign(data.authorizationUrl);
    } catch (err) {
      console.error('Error initializing payment:', err);
      toast.error(err instanceof Error ? err.message : 'Unable to start payment.');
      setRenewing(false);
    }
  };

  return (
    <div className="space-y-8">
      <SEO title="Tuition Renewal & Billing Statements | Jaystarbliss Studios" description="Renew academic terms, manage institutional partnerships, and download tuition invoices." noindex={true} />

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-red font-bold text-xs uppercase tracking-wider mb-1"><CreditCard size={14} /> Financial Desk & Tuition</div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">{isSchool ? 'Institutional Licensing & Term Renewal' : 'Tuition & Membership Renewal'}</h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">{isSchool ? 'Manage school lab subscriptions, student seat allocations, and verified invoices.' : 'Secure term renewals, review receipts, and maintain active access codes.'}</p>
        </div>
        <div className="flex items-center gap-3"><div className="px-4 py-2 rounded-2xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 text-xs font-bold flex items-center gap-1.5"><ShieldCheck size={16} /> 256-Bit SSL Encrypted</div></div>
      </div>

      <div>
        <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4">{isSchool ? 'School Partnership & Renewal Packages' : 'Choose Your Term Renewal Track'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan: any) => (
            <div key={plan.id} className={`rounded-3xl p-6 border transition-all flex flex-col justify-between relative ${plan.popular ? 'border-brand-red bg-white dark:bg-slate-900 shadow-lg ring-1 ring-brand-red/30' : 'border-gray-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-xs'}`}>
              {plan.popular && <span className="absolute -top-3 right-6 px-3 py-0.5 bg-brand-red text-white text-[10px] font-black uppercase rounded-full tracking-wider shadow-sm">Recommended</span>}
              <div>
                <h3 className="font-black text-lg text-gray-900 dark:text-white mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 my-3"><span className="text-3xl font-black text-brand-slate dark:text-white font-mono">{plan.price}</span><span className="text-xs text-gray-500 font-medium">{plan.period}</span></div>
                <div className="space-y-2.5 my-5 text-xs text-gray-600 dark:text-gray-300">{plan.features.map((feature: string) => <div key={feature} className="flex items-center gap-2.5"><CheckCircle2 size={15} className="text-green-500 shrink-0" /><span>{feature}</span></div>)}</div>
              </div>
              <button type="button" onClick={() => handleInitiateRenewal(plan.name)} className={`min-h-11 w-full py-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 ${plan.popular ? 'bg-brand-red hover:bg-red-700 text-white shadow-md' : 'bg-brand-slate hover:bg-slate-800 text-white'}`}><span>Renew Membership</span><ArrowRight size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <FintechTransactionHistory 
          transactions={payments} 
          title="Payment Receipts & Invoices"
          role={role}
          emptyMessage="No transaction records on file"
        />
      </div>

      {renewalSuccess && <div className="fixed bottom-5 right-5 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300"><div className="flex items-center gap-2"><CheckCircle2 size={18} /> Payment verified successfully.</div></div>}

      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 w-full max-w-md p-6 shadow-2xl">
            <h3 id="checkout-title" className="text-lg font-black text-gray-900 dark:text-white">Confirm {selectedPlan}</h3>
            <p className="text-xs text-gray-500 mt-1">Choose a supported Paystack payment channel. You will be redirected to the secure checkout page.</p>
            <form onSubmit={handleProcessPayment} className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-700 p-3 cursor-pointer"><input type="radio" name="paymentMethod" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} /><span><span className="block text-sm font-bold text-gray-900 dark:text-white">Card</span><span className="text-xs text-gray-500">Visa, Mastercard and supported cards.</span></span></label>
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-700 p-3 cursor-pointer"><input type="radio" name="paymentMethod" value="bank_transfer" checked={paymentMethod === 'bank_transfer'} onChange={() => setPaymentMethod('bank_transfer')} /><span><span className="block text-sm font-bold text-gray-900 dark:text-white">Bank Transfer</span><span className="text-xs text-gray-500">Use Paystack's generated transfer instructions.</span></span></label>
              </div>
              <div className="flex gap-3 border-t border-gray-100 dark:border-slate-800 pt-4"><button type="button" onClick={() => setShowCheckoutModal(false)} className="min-h-11 flex-1 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-gray-300">Cancel</button><button type="submit" disabled={renewing} className="min-h-11 flex-1 rounded-xl bg-brand-red text-white text-xs font-bold disabled:opacity-50">{renewing ? 'Opening Secure Checkout…' : 'Continue to Paystack'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalPayments;
