import React, { useState, useEffect } from 'react';
import { 
  collection, addDoc, updateDoc, doc, getDoc, 
  query, orderBy, serverTimestamp, onSnapshot 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { 
  CreditCard, CheckCircle2, Clock, Plus, 
  Search, Users, DollarSign
} from 'lucide-react';

const AdminParents: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'enrollments' | 'payments' | 'newPayment'>('enrollments');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Enrollment Requests
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [enrFilter, setEnrFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingEnrId, setProcessingEnrId] = useState<string | null>(null);

  // Payments Ledger
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // Manual Transaction Form
  const [payForm, setPayForm] = useState({
    studentId: '',
    parentId: '',
    amount: '',
    plan: '2x_week',
    status: 'paid',
    reference: ''
  });
  const [addingPayment, setAddingPayment] = useState(false);

  // Real-time listener for enrollment requests & payments
  useEffect(() => {
    setLoading(true);

    const qEnr = query(collection(db, 'enrollment_requests'), orderBy('createdAt', 'desc'));
    const unsubEnr = onSnapshot(qEnr, (snap) => {
      setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    const qPay = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    const unsubPay = onSnapshot(qPay, (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error(err);
    });

    return () => {
      unsubEnr();
      unsubPay();
    };
  }, []);

  const generateAccessCode = (length = 7) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => chars[b % chars.length]).join('');
  };

  // Approve Enrollment Request
  const handleApproveEnrollment = async (enr: any) => {
    if (!window.confirm(`Approve enrollment for student "${enr.studentName}" (Plan: ${enr.plan})?`)) return;
    setProcessingEnrId(enr.id);
    try {
      const accessCode = generateAccessCode();
      let studentId = enr.studentId;

      if (!studentId) {
        const username = (enr.studentEmail || enr.studentName || 'student')
          .split('@')[0].replace(/\s+/g, '').toLowerCase();

        const indivRef = await addDoc(collection(db, 'individualStudents'), {
          fullName: enr.studentName,
          username,
          email: (enr.studentEmail || '').toLowerCase(),
          accessCode,
          parentId: enr.parentId || null,
          subjects: Array.isArray(enr.subjects) ? enr.subjects : (enr.subjects || '').split(',').map((s: string) => s.trim()).filter(Boolean),
          plan: enr.plan || '',
          schedule: enr.schedule || '',
          registeredAt: serverTimestamp()
        });
        studentId = indivRef.id;

        // Auto-create initial paid/confirmed payment entry
        await addDoc(collection(db, 'payments'), {
          parentId: enr.parentId || '',
          studentId,
          enrollmentId: enr.id,
          amount: enr.amount || 0,
          plan: enr.plan || '',
          status: 'paid',
          reference: `ENR-${enr.id.slice(0, 6).toUpperCase()}`,
          confirmedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }

      // Link to parent's children collection if parentId exists
      if (enr.parentId) {
        try {
          const parentRef = doc(db, 'parents', enr.parentId);
          const parentSnap = await getDoc(parentRef);
          if (parentSnap.exists()) {
            const currentChildren = parentSnap.data().children || [];
            if (!currentChildren.includes(studentId)) {
              await updateDoc(parentRef, { children: [...currentChildren, studentId] });
            }
          }
        } catch (e) {
          console.warn('Could not link to parent doc:', e);
        }
      }

      // Update enrollment request document
      await updateDoc(doc(db, 'enrollment_requests', enr.id), {
        status: 'approved',
        studentId,
        accessCode: accessCode || enr.accessCode || '',
        approvedAt: serverTimestamp()
      });

      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        type: 'enrollment_approved',
        enrId: enr.id,
        studentId,
        studentName: enr.studentName,
        timestamp: serverTimestamp()
      });

      toast.success(`Enrollment approved! Student ID: ${studentId} | Access Code: ${accessCode}`);
    } catch (err: any) {
      toast.error('Error approving enrollment: ' + err.message);
    } finally {
      setProcessingEnrId(null);
    }
  };

  // Reject Enrollment Request
  const handleRejectEnrollment = async (enr: any) => {
    const reason = window.prompt('Enter rejection / feedback reason for the family:');
    if (reason === null) return;
    setProcessingEnrId(enr.id);
    try {
      await updateDoc(doc(db, 'enrollment_requests', enr.id), {
        status: 'rejected',
        rejectionReason: reason || 'Requirements not met or schedule unavailable.',
        rejectedAt: serverTimestamp()
      });
      toast.info(`Enrollment for ${enr.studentName} marked as rejected.`);
    } catch (err: any) {
      toast.error('Error rejecting enrollment: ' + err.message);
    } finally {
      setProcessingEnrId(null);
    }
  };

  // Toggle Payment Status (Paid / Pending)
  const handleTogglePaymentStatus = async (paymentId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        paidAt: nextStatus === 'paid' ? serverTimestamp() : null
      });
      toast.success(`Payment status updated to ${nextStatus.toUpperCase()}.`);
    } catch (err: any) {
      toast.error('Error updating payment: ' + err.message);
    }
  };

  // Add Manual Payment Transaction
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.studentId.trim() || !payForm.amount) {
      toast.error('Please specify the Student ID and payment amount.');
      return;
    }
    setAddingPayment(true);
    try {
      await addDoc(collection(db, 'payments'), {
        studentId: payForm.studentId.trim(),
        parentId: payForm.parentId.trim() || null,
        amount: parseFloat(payForm.amount) || 0,
        plan: payForm.plan,
        status: payForm.status,
        reference: payForm.reference.trim() || `MANUAL-${Date.now().toString().slice(-6)}`,
        createdAt: serverTimestamp()
      });

      toast.success('Payment transaction record recorded successfully!');
      setPayForm({ studentId: '', parentId: '', amount: '', plan: '2x_week', status: 'paid', reference: '' });
      setActiveTab('payments');
    } catch (err: any) {
      toast.error('Error recording payment: ' + err.message);
    } finally {
      setAddingPayment(false);
    }
  };

  // Metrics Calculations
  const totalRevenue = payments
    .filter(p => p.status === 'paid')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const pendingAmount = payments
    .filter(p => p.status === 'pending')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const pendingEnrollmentsCount = enrollments.filter(e => e.status === 'pending').length;

  const filteredEnrollments = enrollments.filter(e => {
    const matchesFilter = enrFilter === 'all' || e.status === enrFilter;
    const matchesSearch = 
      e.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.studentEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.plan?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredPayments = payments.filter(p => {
    const matchesFilter = paymentFilter === 'all' || p.status === paymentFilter;
    const matchesSearch = 
      p.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.plan?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-slate dark:text-white flex items-center gap-3">
            <CreditCard className="text-brand-red w-8 h-8" />
            Parent Hub &amp; Family Enrollments
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review parent-submitted course enrollments, verify tuition transactions, and audit verified student linkings.
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={() => setActiveTab('newPayment')}
          className="flex items-center gap-2 bg-brand-red hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm"
        >
          <Plus size={16} /> Record Transaction
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Revenue Confirmed</span>
            <div className="text-2xl font-black font-mono text-gray-900 dark:text-white mt-0.5">
              ₦{totalRevenue.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Tuition Fees</span>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              ₦{pendingAmount.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center font-black">
            <Users size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Enrollments</span>
            <div className="text-2xl font-black font-mono text-brand-red mt-0.5">
              {pendingEnrollmentsCount} Requests
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('enrollments')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'enrollments'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Users size={17} />
          <span>Enrollment Requests ({enrollments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <CreditCard size={17} />
          <span>Payments Ledger ({payments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('newPayment')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'newPayment'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Plus size={17} />
          <span>Record New Transaction</span>
        </button>
      </div>

      {/* ══ TAB 1: ENROLLMENT REQUESTS ══ */}
      {activeTab === 'enrollments' && (
        <div className="space-y-6">
          {/* Subfilters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setEnrFilter(filter)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    enrFilter === filter
                      ? 'bg-brand-slate dark:bg-white text-white dark:text-brand-slate shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or parent..."
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading enrollment requests...</div>
          ) : filteredEnrollments.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
              No enrollment requests matching current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEnrollments.map((enr) => (
                <div 
                  key={enr.id}
                  className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                          👤 {enr.studentName}
                        </h3>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Parent: <span className="font-bold text-gray-700 dark:text-gray-300">{enr.parentName || enr.parentId || 'Anonymous Parent'}</span>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                        enr.status === 'approved' 
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                          : enr.status === 'rejected'
                          ? 'bg-red-500/10 text-red-600 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}>
                        {enr.status || 'PENDING'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700/60 text-xs mb-4">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Selected Plan:</span>
                        <div className="font-extrabold text-brand-red capitalize">{enr.plan?.replace('_', ' ') || 'Standard'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Amount:</span>
                        <div className="font-extrabold font-mono text-gray-900 dark:text-white">₦{(enr.amount || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Schedule:</span>
                        <div className="font-bold text-gray-700 dark:text-gray-300">{enr.schedule || 'Flexible'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Submitted:</span>
                        <div className="font-mono text-gray-500">{enr.createdAt?.toDate ? enr.createdAt.toDate().toLocaleDateString() : 'Recent'}</div>
                      </div>
                    </div>

                    {enr.subjects && (
                      <div className="mb-4">
                        <span className="text-[11px] font-bold text-gray-400 block mb-1.5 uppercase">Requested Subjects:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {(Array.isArray(enr.subjects) ? enr.subjects : enr.subjects.split(',')).map((sub: string, i: number) => (
                            <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                              {sub.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {enr.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-4">
                        "{enr.notes}"
                      </p>
                    )}

                    {enr.status === 'approved' && enr.accessCode && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs mb-4">
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold block mb-0.5">Assigned Access Passcode:</span>
                        <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-wider">
                          {enr.accessCode}
                        </span>
                      </div>
                    )}
                  </div>

                  {enr.status === 'pending' && (
                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex gap-2">
                      <button
                        onClick={() => handleApproveEnrollment(enr)}
                        disabled={processingEnrId === enr.id}
                        className="flex-1 py-2.5 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} /> Confirm &amp; Approve
                      </button>
                      <button
                        onClick={() => handleRejectEnrollment(enr)}
                        disabled={processingEnrId === enr.id}
                        className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 text-gray-600 dark:text-gray-400 font-bold text-xs rounded-xl transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 2: PAYMENTS LEDGER ══ */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2">
              {(['all', 'paid', 'pending'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPaymentFilter(filter)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    paymentFilter === filter
                      ? 'bg-brand-slate dark:bg-white text-white dark:text-brand-slate shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference or student ID..."
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="p-4">Reference</th>
                    <th className="p-4">Student ID / Cohort</th>
                    <th className="p-4">Plan Track</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-medium">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        No transaction records found.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-mono font-bold text-gray-900 dark:text-white">
                          {pay.reference || `TX-${pay.id.slice(0, 6).toUpperCase()}`}
                        </td>
                        <td className="p-4 font-mono text-gray-600 dark:text-gray-400">
                          {pay.studentId || '—'}
                        </td>
                        <td className="p-4 font-bold text-brand-red capitalize">
                          {pay.plan?.replace('_', ' ') || 'General Tuition'}
                        </td>
                        <td className="p-4 font-mono font-black text-sm text-gray-900 dark:text-white">
                          ₦{(pay.amount || 0).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            pay.status === 'paid' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}>
                            {pay.status === 'paid' ? 'PAID' : 'PENDING'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-gray-500">
                          {pay.createdAt?.toDate ? pay.createdAt.toDate().toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleTogglePaymentStatus(pay.id, pay.status)}
                            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-bold transition-colors"
                          >
                            Mark {pay.status === 'paid' ? 'Pending' : 'Paid'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB 3: RECORD MANUAL PAYMENT ══ */}
      {activeTab === 'newPayment' && (
        <div className="max-w-2xl bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Plus size={20} className="text-brand-red" />
              Record Tuition Transaction
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Add direct bank transfers, cash payments, or customized sponsorship credit records.
            </p>
          </div>

          <form onSubmit={handleAddPayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Student Doc ID / Username *
                </label>
                <input
                  type="text"
                  required
                  value={payForm.studentId}
                  onChange={(e) => setPayForm({ ...payForm, studentId: e.target.value })}
                  placeholder="e.g. david_alabi or Firestore ID"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Parent Document ID (Optional)
                </label>
                <input
                  type="text"
                  value={payForm.parentId}
                  onChange={(e) => setPayForm({ ...payForm, parentId: e.target.value })}
                  placeholder="Parent ID or leave blank"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Amount in Naira (₦) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  placeholder="e.g. 35000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Curriculum Plan
                </label>
                <select
                  value={payForm.plan}
                  onChange={(e) => setPayForm({ ...payForm, plan: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="2x_week">2× per Week (₦25,000/mo)</option>
                  <option value="3x_week">3× per Week (₦35,000/mo)</option>
                  <option value="standard">Standard (₦18,000/mo)</option>
                  <option value="intensive">Intensive (₦55,000/mo)</option>
                  <option value="full_blast">Full Blast (₦60,000/mo)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Transaction Status
                </label>
                <select
                  value={payForm.status}
                  onChange={(e) => setPayForm({ ...payForm, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="paid">Paid (Verified)</option>
                  <option value="pending">Pending Confirmation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Bank Reference / Slip Note
                </label>
                <input
                  type="text"
                  value={payForm.reference}
                  onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                  placeholder="e.g. GTB/TRF/982142"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addingPayment}
              className="w-full py-3.5 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 mt-4"
            >
              {addingPayment ? 'Recording...' : 'Save Transaction'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminParents;
