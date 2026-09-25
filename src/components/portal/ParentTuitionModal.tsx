import React, { useState } from 'react';
import { 
  X, Save, DollarSign, BookOpen, Clock, UserCheck, 
  CreditCard, ShieldCheck, CheckCircle2, Download, AlertCircle 
} from 'lucide-react';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, generatePdfReceipt } from '../../lib/receiptGenerator';

export interface UnifiedParentStudent {
  id: string;
  source: 'individualStudents' | 'students' | 'enrollment_requests' | 'users';
  studentName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  plan: string;
  amount: number;
  cycle: 'monthly' | 'termly' | 'annual';
  teachingMode: string;
  tutorId?: string;
  tutorName?: string;
  tutorPayoutRate?: number;
  status: string;
  schoolName?: string;
  age?: string;
  grade?: string;
  createdAt?: string;
}

export interface ParentTuitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: UnifiedParentStudent | null;
  tutors: Array<{ id: string; name: string; email?: string }>;
  onSaved: () => Promise<void>;
}

const PROGRAM_OPTIONS = [
  'Full-Stack Web Engineering',
  'Python AI & Machine Learning',
  'Robotics, IoT & Electronics',
  'Game Development (Roblox & Unity)',
  'Mobile App Development (Flutter)',
  'Scratch Creative Coding & Animation',
  'Data Science & Analytics',
  'Cybersecurity Fundamentals',
  'Creative Computing & Graphics'
];

export const ParentTuitionModal: React.FC<ParentTuitionModalProps> = ({
  isOpen,
  onClose,
  student,
  tutors,
  onSaved
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'payment'>('config');

  // Form State
  const [studentName, setStudentName] = useState(student?.studentName || '');
  const [parentName, setParentName] = useState(student?.parentName || '');
  const [parentEmail, setParentEmail] = useState(student?.parentEmail || '');
  const [parentPhone, setParentPhone] = useState(student?.parentPhone || '');
  const [plan, setPlan] = useState(student?.plan || '');
  const [customPlan, setCustomPlan] = useState('');
  const [amount, setAmount] = useState(student?.amount ? String(student.amount) : '');
  const [cycle, setCycle] = useState<'monthly' | 'termly' | 'annual'>(student?.cycle || 'monthly');
  const [teachingMode, setTeachingMode] = useState(student?.teachingMode || 'Online 1-on-1');
  const [tutorId, setTutorId] = useState(student?.tutorId || '');
  const [tutorPayoutRate, setTutorPayoutRate] = useState(student?.tutorPayoutRate ? String(student.tutorPayoutRate) : '');
  const [status, setStatus] = useState(student?.status || 'PENDING');

  // Payment Recording State
  const [payAmount, setPayAmount] = useState(student?.amount ? String(student.amount) : '');
  const [payReference, setPayReference] = useState(`TX-PARENT-${Date.now().toString().slice(-6)}`);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState('Direct Bank Settlement / Wire');

  // Update form fields when student changes
  React.useEffect(() => {
    if (student) {
      setStudentName(student.studentName || '');
      setParentName(student.parentName || '');
      setParentEmail(student.parentEmail || '');
      setParentPhone(student.parentPhone || '');
      setPlan(student.plan || '');
      setCustomPlan('');
      setAmount(student.amount ? String(student.amount) : '');
      setCycle(student.cycle || 'monthly');
      setTeachingMode(student.teachingMode || 'Online 1-on-1');
      setTutorId(student.tutorId || '');
      setTutorPayoutRate(student.tutorPayoutRate ? String(student.tutorPayoutRate) : '');
      setStatus(student.status || 'PENDING');
      setPayAmount(student.amount ? String(student.amount) : '');
      setPayReference(`TX-PARENT-${Date.now().toString().slice(-6)}`);
    }
  }, [student]);

  if (!isOpen || !student) return null;

  const assignedTutorObj = tutors.find(t => t.id === tutorId);
  const effectivePlanName = plan === 'OTHER' ? (customPlan || 'Custom Technology Track') : plan;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedAmount = Number(amount) || 0;
      const parsedPayout = Number(tutorPayoutRate) || 0;
      const assignedTutorName = assignedTutorObj ? assignedTutorObj.name : (student.tutorName || '');

      const updatePayload: Record<string, any> = {
        fullName: studentName,
        studentName,
        parentName,
        parentEmail,
        parentPhone,
        phone: parentPhone,
        plan: effectivePlanName,
        track: effectivePlanName,
        courseName: effectivePlanName,
        amount: parsedAmount,
        tuitionFee: parsedAmount,
        cycle,
        teachingMode,
        mode: teachingMode,
        status,
        accountStatus: status === 'APPROVED' || status === 'ACTIVE' || status === 'PAID' ? 'ACTIVE' : status,
        updatedAt: serverTimestamp()
      };

      if (tutorId) {
        updatePayload.tutorId = tutorId;
        updatePayload.tutorName = assignedTutorName;
        updatePayload.tutorPayoutRate = parsedPayout;
      }

      // Save to appropriate collection
      if (student.source === 'individualStudents') {
        await updateDoc(doc(db, 'individualStudents', student.id), updatePayload).catch(async () => {
          await setDoc(doc(db, 'individualStudents', student.id), updatePayload, { merge: true });
        });
      } else if (student.source === 'students') {
        await updateDoc(doc(db, 'students', student.id), updatePayload).catch(async () => {
          await setDoc(doc(db, 'students', student.id), updatePayload, { merge: true });
        });
      } else if (student.source === 'enrollment_requests') {
        await updateDoc(doc(db, 'enrollment_requests', student.id), updatePayload).catch(async () => {
          await setDoc(doc(db, 'enrollment_requests', student.id), updatePayload, { merge: true });
        });
      } else {
        await setDoc(doc(db, 'individualStudents', student.id), updatePayload, { merge: true });
      }

      toast.success(`Tuition & program configuration saved for ${studentName || 'Scholar'}.`);
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update tuition settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordBankPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(payAmount) || 0;
    if (numAmount <= 0) {
      toast.error('Please enter a valid tuition fee amount.');
      return;
    }

    setSaving(true);
    try {
      const txRef = payReference.trim() || `TX-PARENT-${Date.now()}`;
      const paymentRecord = {
        reference: txRef,
        studentId: student.id,
        studentName: studentName || student.studentName,
        parentName: parentName || student.parentName,
        payerName: parentName || studentName || 'Parent',
        payerEmail: parentEmail || '',
        payerPhone: parentPhone || '',
        amount: numAmount,
        customerTotal: numAmount,
        baseAmount: numAmount,
        transactionFee: 0,
        type: 'inflow',
        category: 'parent_tuition',
        status: 'PAID',
        channel: 'bank_transfer',
        method: 'bank_transfer',
        plan: effectivePlanName,
        description: `Tuition Settlement (${effectivePlanName}) - ${studentName}`,
        teachingMode,
        cycle,
        notes: payNotes,
        paidAt: payDate ? new Date(payDate).toISOString() : new Date().toISOString(),
        createdAt: serverTimestamp()
      };

      // Save to payments collection
      await setDoc(doc(db, 'payments', txRef), paymentRecord);

      // Also update student status to PAID / ACTIVE
      const studentUpdate = {
        status: 'PAID',
        accountStatus: 'ACTIVE',
        lastPaymentAmount: numAmount,
        lastPaymentDate: paymentRecord.paidAt,
        updatedAt: serverTimestamp()
      };

      if (student.source === 'individualStudents') {
        await updateDoc(doc(db, 'individualStudents', student.id), studentUpdate).catch(() => {});
      } else if (student.source === 'enrollment_requests') {
        await updateDoc(doc(db, 'enrollment_requests', student.id), studentUpdate).catch(() => {});
      }

      toast.success(`Tuition payment of ${formatCurrency(numAmount)} recorded successfully!`);

      // Generate receipt
      generatePdfReceipt({
        id: txRef,
        reference: txRef,
        payerName: parentName || studentName,
        payerEmail: parentEmail,
        amount: numAmount,
        customerTotal: numAmount,
        baseAmount: numAmount,
        description: `Tuition Settlement (${effectivePlanName}) - ${studentName}`,
        plan: effectivePlanName,
        category: 'parent_tuition',
        status: 'PAID',
        paymentMethod: 'Bank Transfer',
        paidAt: paymentRecord.paidAt,
        studentName: studentName || student.studentName
      });

      await onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to record parent payment.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-red/10 text-brand-red flex items-center justify-center font-bold">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Manage Tuition &amp; Program Schedule
              </h3>
              <p className="text-xs text-slate-500">
                Configure student fees, curriculum tracks, and assign faculty mentors
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'config'
                ? 'bg-brand-red text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <BookOpen size={14} />
            <span>Tuition &amp; Program Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payment')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'payment'
                ? 'bg-brand-red text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <CreditCard size={14} />
            <span>Record Bank Settlement</span>
          </button>
        </div>

        {/* TAB 1: Config */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveConfig} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                  Student / Cadet Name
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Adeola Johnson"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                  Parent / Guardian Name
                </label>
                <input
                  type="text"
                  value={parentName}
                  onChange={e => setParentName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Mrs. Sarah Johnson"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                  Parent Email
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={e => setParentEmail(e.target.value)}
                  className={inputClass}
                  placeholder="parent@example.com"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                  Parent Phone Number
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={e => setParentPhone(e.target.value)}
                  className={inputClass}
                  placeholder="+234 800 000 0000"
                />
              </div>
            </div>

            {/* Program & Fee Details */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                    Assigned Curriculum Track
                  </label>
                  <select
                    value={PROGRAM_OPTIONS.includes(plan) ? plan : (plan ? 'OTHER' : '')}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'OTHER') {
                        setPlan('OTHER');
                        setCustomPlan(plan && !PROGRAM_OPTIONS.includes(plan) ? plan : '');
                      } else {
                        setPlan(val);
                        setCustomPlan('');
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">-- Select Curriculum Track --</option>
                    {PROGRAM_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="OTHER">Other (Custom Program)</option>
                  </select>
                </div>

                {(plan === 'OTHER' || (!PROGRAM_OPTIONS.includes(plan) && plan !== '')) && (
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                      Specify Custom Program Name
                    </label>
                    <input
                      type="text"
                      value={customPlan || (plan !== 'OTHER' ? plan : '')}
                      onChange={e => {
                        setCustomPlan(e.target.value);
                        setPlan('OTHER');
                      }}
                      placeholder="e.g. Advanced Embedded C++"
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                    Tuition Fee (₦ NGN) <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className={inputClass}
                    placeholder="45000"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                    Billing Cycle
                  </label>
                  <select
                    value={cycle}
                    onChange={e => setCycle(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="monthly">Monthly (4 Weeks)</option>
                    <option value="termly">Termly (12 Weeks)</option>
                    <option value="annual">Annual Academic Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                    Teaching Delivery Mode
                  </label>
                  <select
                    value={teachingMode}
                    onChange={e => setTeachingMode(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Online 1-on-1">Online 1-on-1 Live Class</option>
                    <option value="Physical Home Tutoring">Physical Home Tutoring</option>
                    <option value="Hybrid (Online + In-Studio)">Hybrid (Online + In-Studio)</option>
                    <option value="Weekend Academy Group">Weekend Academy Group</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                    Enrollment Status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className={inputClass}
                  >
                    <option value="APPROVED">APPROVED (Active Access)</option>
                    <option value="PAID">PAID (Verified Settlement)</option>
                    <option value="PENDING">PENDING (Awaiting Review)</option>
                  </select>
                </div>
              </div>

              {/* Faculty Tutor Assignment */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                    Assign Faculty Tutor / Mentor
                  </label>
                  <select
                    value={tutorId}
                    onChange={e => setTutorId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- No Tutor Assigned --</option>
                    {tutors.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.email || 'Faculty'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                    Tutor Payout Rate (₦ NGN per cycle)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={tutorPayoutRate}
                    onChange={e => setTutorPayoutRate(e.target.value)}
                    className={inputClass}
                    placeholder="15000"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-2xl bg-brand-red hover:bg-red-700 text-white text-xs font-black inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <Save size={15} />
                <span>{saving ? 'Saving Changes...' : 'Save Tuition Settings'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Record Bank Payment */}
        {activeTab === 'payment' && (
          <form onSubmit={handleRecordBankPayment} className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200">
              <p className="font-bold">Direct Offline Bank Settlement</p>
              <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                Recording this payment marks the parent's tuition as PAID, updates their access status, and instantly triggers an official verifiable PDF receipt.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                  Payment Amount (₦ NGN) <span className="text-brand-red">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                  Payment Reference / Bank Slip ID
                </label>
                <input
                  type="text"
                  required
                  value={payReference}
                  onChange={e => setPayReference(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                  Settlement Date
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                  Payment Notes / Bank Name
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="e.g. Zenith Bank Transfer"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <Download size={15} />
                <span>{saving ? 'Recording...' : `Record Payment & Issue Receipt (${formatCurrency(Number(payAmount) || 0)})`}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
