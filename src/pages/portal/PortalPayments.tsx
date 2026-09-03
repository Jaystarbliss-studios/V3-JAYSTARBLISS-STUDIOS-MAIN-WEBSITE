import React, { useState, useEffect } from 'react';
import { 
  CreditCard, ShieldCheck, CheckCircle2, Download, 
  Building2,
  ArrowRight, FileText
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import jsPDF from 'jspdf';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '../../contexts/ToastContext';
import SEO from '../../components/ui/SEO';

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

  useEffect(() => {
    const userRole = sessionStorage.getItem('userRole') || 'student';
    setRole(userRole.toLowerCase());

    const fetchPaymentHistory = async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        const userUid = user?.uid;

        if (!userUid) {
          setPayments([]);
          return;
        }

        // Query only records belonging to the authenticated account. Do not
        // download the entire payments collection into the browser.
        const ownedQueries = [
          query(collection(db, 'payments'), where('userId', '==', userUid)),
          query(collection(db, 'payments'), where('parentId', '==', userUid)),
          query(collection(db, 'payments'), where('schoolId', '==', userUid))
        ];
        const snapshots = await Promise.all(ownedQueries.map(getDocs));
        const list: PaymentRecord[] = [];
        const seen = new Set<string>();
        snapshots.forEach(snap => snap.forEach(d => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            list.push({ id: d.id, ...d.data() });
          }
        }));
        list.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

        // If no past transactions in DB, show initial active tier
        setPayments(list);
      } catch (err) {
        console.warn('Payments load error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentHistory();
  }, []);

  const handleDownloadReceipt = (payment: PaymentRecord) => {
    try {
      const pdf = new jsPDF();
      const reference = payment.reference || payment.id;
      const rawDate = payment.createdAt;
      const date = rawDate instanceof Date
        ? rawDate
        : typeof rawDate === 'string'
          ? new Date(rawDate)
          : rawDate && typeof rawDate.toDate === 'function'
            ? rawDate.toDate()
            : new Date();

      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('JAYSTARBLISS STUDIOS', 20, 25);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Official Payment Receipt', 20, 33);
      pdf.line(20, 38, 190, 38);

      pdf.setFontSize(10);
      pdf.text('Transaction reference:', 20, 52);
      pdf.setFont('helvetica', 'bold');
      pdf.text(reference, 75, 52);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Date:', 20, 62);
      pdf.text(date.toLocaleDateString(), 75, 62);
      pdf.text('Description:', 20, 72);
      pdf.text(String(payment.plan || payment.description || 'Tuition Renewal'), 75, 72);
      pdf.text('Payment method:', 20, 82);
      pdf.text(String(payment.paymentMethod || 'Online Paystack'), 75, 82);
      pdf.text('Status:', 20, 92);
      pdf.text(String(payment.status || 'Verified'), 75, 92);

      pdf.line(20, 105, 190, 105);
      pdf.setFontSize(15);
      pdf.setFont('helvetica', 'bold');
      const amount = typeof payment.amount === 'number'
        ? payment.amount.toLocaleString()
        : String(payment.amount ?? '0');
      pdf.text(`Amount paid: ₦${amount}`, 20, 118);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Keep this receipt for your academic and financial records.', 20, 135);
      pdf.text('Jaystarbliss Studios • Learn. Build. Create. Grow.', 20, 145);
      pdf.save(`jaystarbliss-receipt-${reference}.pdf`);
      toast.success('Payment receipt downloaded successfully.');
    } catch (err) {
      console.error('Receipt generation error:', err);
      toast.error('Unable to generate this receipt right now.');
    }
  };

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
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        setTimeout(() => setRenewalSuccess(false), 3000);
      } catch (err) {
        console.error('Returned payment verification error:', err);
        toast.error(err instanceof Error ? err.message : 'We could not verify this payment yet.');
      }
    };
    verifyReturnedPayment();
  }, [toast]);

  const isSchool = role.includes('school');

  const studentPlans = [
    {
      id: 'plan_weekend',
      name: 'Weekend STEM & Coding Track',
      price: '₦45,000',
      period: '/ Term',
      features: ['Saturday 10am Live Class', 'Scratch, Python & React Lab', 'Mentor Project Review', 'Certificate of Completion']
    },
    {
      id: 'plan_mentorship',
      name: '1-on-1 Intensive Mentorship',
      price: '₦120,000',
      period: '/ Term',
      popular: true,
      features: ['Dedicated STEM Instructor', 'Personalized Schedule', 'AI & Machine Learning Track', 'Direct WhatsApp Assistance']
    },
    {
      id: 'plan_robotics',
      name: 'Smart Robotics & IoT Hardware Lab',
      price: '₦85,000',
      period: '/ Term',
      features: ['Arduino & Microcontroller Kits', 'Bi-weekly Hands-on Lab', 'Hardware Component Pack', 'Competition Mentorship']
    }
  ];

  const schoolPlans = [
    {
      id: 'school_standard',
      name: 'Institutional STEM Lab Partner',
      price: '₦350,000',
      period: '/ Academic Term',
      features: ['Onboarding up to 100 Cadets', 'Full 5-Stage Curriculum Access', 'Tutor Dispatch & Super-Admin Oversight', 'Custom School Subdomain & Access Codes']
    },
    {
      id: 'school_cbt',
      name: 'CBT Exam Portal & Lab Suite',
      price: '₦600,000',
      period: '/ Academic Session',
      popular: true,
      features: ['Unlimited Student Access Codes', 'Offline/Online CBT Assessment Engine', 'Robotics Kit Hardware Delivery', 'Teacher Training & Certification']
    }
  ];

  const plans = isSchool ? schoolPlans : studentPlans;

  const handleInitiateRenewal = (planName: string) => {
    setSelectedPlan(planName);
    setShowCheckoutModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !selectedPlan) {
      toast.error('Please sign in before starting payment.');
      return;
    }

    setRenewing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/.netlify/functions/paystack-initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ planId: plans.find(p => p.name === selectedPlan)?.id })
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
      <SEO 
        title="Tuition Renewal & Billing Statements | Jaystarbliss Studios" 
        description="Renew academic terms, manage institutional partnerships, and download tuition invoices." 
        noindex={true}
      />

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-red font-bold text-xs uppercase tracking-wider mb-1">
            <CreditCard size={14} /> Financial Desk & Tuition
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">
            {isSchool ? 'Institutional Licensing & Term Renewal' : 'Tuition & Membership Renewal'}
          </h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSchool 
              ? 'Manage school lab subscriptions, student seat allocations, and verified invoices.' 
              : 'Secure term renewals, review receipts, and maintain active access codes.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck size={16} /> 256-Bit SSL Encrypted
          </div>
        </div>
      </div>

      {/* Plans & Renewal Pricing */}
      <div>
        <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4">
          {isSchool ? 'School Partnership & Renewal Packages' : 'Choose Your Term Renewal Track'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan: any) => (
            <div 
              key={plan.id} 
              className={`rounded-3xl p-6 border transition-all flex flex-col justify-between relative ${
                plan.popular 
                  ? 'border-brand-red bg-white dark:bg-slate-900 shadow-lg ring-1 ring-brand-red/30' 
                  : 'border-gray-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-xs'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 right-6 px-3 py-0.5 bg-brand-red text-white text-[10px] font-black uppercase rounded-full tracking-wider shadow-sm">
                  Recommended
                </span>
              )}

              <div>
                <h3 className="font-black text-lg text-gray-900 dark:text-white mb-1">
                  {plan.name}
                </h3>
                
                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-3xl font-black text-brand-slate dark:text-white font-mono">{plan.price}</span>
                  <span className="text-xs text-gray-500 font-medium">{plan.period}</span>
                </div>

                <div className="space-y-2.5 my-5 text-xs text-gray-600 dark:text-gray-300">
                  {plan.features.map((f: string, i: number) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleInitiateRenewal(plan.name)}
                className={`w-full py-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 ${
                  plan.popular
                    ? 'bg-brand-red hover:bg-red-700 text-white shadow-md'
                    : 'bg-brand-slate hover:bg-slate-800 text-white'
                }`}
              >
                <span>Renew Membership</span> <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction & Receipt Statements */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment Receipts & Invoices</h3>
            <p className="text-xs text-gray-500">Official proof of payment for tax and institutional records.</p>
          </div>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
            {payments.length} Recorded Statements
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-500">Loading billing transactions...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
            <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="font-bold text-gray-700 dark:text-gray-300 text-sm">No transaction records on file</p>
            <p className="text-xs text-gray-500 mt-0.5">When you renew or make tuition settlements, your receipts will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Transaction / Description</th>
                  <th className="pb-3">Reference</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 font-bold text-gray-900 dark:text-white">
                      {p.plan || p.description || 'Tuition Renewal'}
                    </td>
                    <td className="py-3.5 font-mono text-gray-500">
                      {p.reference || p.id}
                    </td>
                    <td className="py-3.5 font-bold font-mono text-gray-900 dark:text-white">
                      ₦{typeof p.amount === 'number' ? p.amount.toLocaleString() : p.amount}
                    </td>
                    <td className="py-3.5 text-gray-600 dark:text-gray-300 capitalize">
                      {p.paymentMethod || 'Online Paystack'}
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300">
                        {p.status || 'Verified'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(p)}
                        className="inline-flex items-center gap-1 text-brand-red hover:underline font-bold text-xs"
                      >
                        <Download size={13} /> PDF Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 border border-gray-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">
              Confirm Tuition & Fee Renewal
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              Target Track: <strong className="text-brand-red">{selectedPlan}</strong>
            </p>

            {renewalSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 size={48} className="mx-auto text-green-500 animate-bounce" />
                <h4 className="font-bold text-gray-900 dark:text-white">Payment Verified!</h4>
                <p className="text-xs text-gray-500">Your access codes and enrollment have been renewed.</p>
              </div>
            ) : (
              <form onSubmit={handleProcessPayment} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-2">Select Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-3 rounded-xl border font-bold text-left transition-all ${
                        paymentMethod === 'card'
                          ? 'border-brand-red bg-brand-red/5 text-brand-red ring-1 ring-brand-red'
                          : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <CreditCard size={18} className="mb-1" />
                      <div>Debit Card / Paystack</div>
                      <div className="text-[10px] font-normal text-gray-500">Instant Verification</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`p-3 rounded-xl border font-bold text-left transition-all ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-brand-red bg-brand-red/5 text-brand-red ring-1 ring-brand-red'
                          : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Building2 size={18} className="mb-1" />
                      <div>Direct Bank Wire</div>
                      <div className="text-[10px] font-normal text-gray-500">Zenith / Moniepoint</div>
                    </button>
                  </div>
                </div>

                {paymentMethod === 'bank_transfer' && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                    <p className="font-bold text-gray-900 dark:text-white">Account Details for Wire Transfer:</p>
                    <p className="text-gray-600 dark:text-gray-300">Bank: <strong>Zenith Bank PLC</strong></p>
                    <p className="text-gray-600 dark:text-gray-300">Account Name: <strong>Jaystarbliss Studios Ltd</strong></p>
                    <p className="text-gray-600 dark:text-gray-300 font-mono">Account Number: <strong>1018472910</strong></p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCheckoutModal(false)}
                    disabled={renewing}
                    className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={renewing}
                    className="flex-1 py-3 px-4 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    {renewing ? 'Verifying...' : 'Authorize Renewal'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default PortalPayments;
