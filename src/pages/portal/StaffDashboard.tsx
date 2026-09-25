import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../lib/firebase';
import { collection, getDocs, getDoc, doc, addDoc, serverTimestamp, query, where, orderBy, limit } from 'firebase/firestore';
import { 
  Users, FileText, Video, Clock, CheckCircle2, 
  ShieldCheck, ArrowRight, Wallet, ArrowDownToLine,
  Sparkles, History, CreditCard, ChevronRight
} from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { DashboardGreeting } from '../../components/portal/DashboardGreeting';
import { FintechWalletCard } from '../../components/portal/FintechWalletCard';
import { FintechWithdrawalModal } from '../../components/portal/FintechWithdrawalModal';
import { FintechTransactionHistory } from '../../components/portal/FintechTransactionHistory';
import { ResourceListView } from '../../components/portal/ResourceListView';
import { StaffClassSchedulesManager } from '../../components/portal/StaffClassSchedulesManager';
import { billingGet, billingPost } from '../../lib/billing';
import { useToast } from '../../contexts/ToastContext';
import { getEffectiveAuth } from '../../utils/impersonation';

const StaffDashboard: React.FC = () => {
  const { toast } = useToast();
  const [resources, setResources] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [assignedSchools, setAssignedSchools] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPlatform, setLinkPlatform] = useState('Google Meet');
  const [meetingTime, setMeetingTime] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fintech Modals
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [banksList, setBanksList] = useState<any[]>([]);
  const [savedBankCode, setSavedBankCode] = useState('');
  const [savedAccountLast4, setSavedAccountLast4] = useState('');
  const [savedAccountName, setSavedAccountName] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'students' | 'wallet' | 'guides'>('all');

  const fetchStaffData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const effective = getEffectiveAuth();
      const currentUser = auth.currentUser;
      if (!currentUser && !effective.isMasquerading) return;

      const staffUid = effective.effectiveUid || currentUser?.uid;

      // 1. Fetch Curriculum Resources
      try {
        const [staffResSnap, generalResSnap, schoolResSnap] = await Promise.all([
          getDocs(collection(db, 'staffGeneralResources')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'resources')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'schoolResources')).catch(() => ({ docs: [] }))
        ]);
        const combined = [
          ...staffResSnap.docs.map(d => ({ id: d.id, ...d.data(), type: d.data().type || 'Curriculum' })),
          ...generalResSnap.docs.map(d => ({ id: d.id, ...d.data(), type: d.data().type || 'Resource' })),
          ...schoolResSnap.docs.map(d => ({ id: d.id, ...d.data(), type: d.data().type || 'School Material' }))
        ];
        // Deduplicate by ID
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        setResources(unique);
      } catch (e) {
        console.warn('staffGeneralResources error:', e);
      }

      // 2. Fetch Assigned Students
      const assignmentFields = ['tutorId', 'staffId', 'assignedTutorId', 'assignedStaffId', 'instructorId'];
      const studentMap = new Map<string, any>();
      if (staffUid) {
        for (const field of assignmentFields) {
          for (const collectionName of ['individualStudents', 'students']) {
            try {
              const snap = await getDocs(query(collection(db, collectionName), where(field, '==', staffUid)));
              snap.forEach(d => studentMap.set(d.id, { id: d.id, ...d.data() }));
            } catch (e) {
              console.warn(`Assigned ${collectionName} query failed for ${field}:`, e);
            }
          }
        }
      }
      const fetchedStudents = Array.from(studentMap.values());
      setStudents(fetchedStudents);

      // Fetch assigned schools
      try {
        const schoolsSnap = await getDocs(collection(db, 'schools')).catch(() => ({ docs: [] } as any));
        const allSchools = schoolsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        const mySchools = allSchools.filter((sch: any) => {
          if (!staffUid) return false;
          if (sch.tutorId === staffUid || sch.assignedTutorId === staffUid || sch.assignedStaffId === staffUid) return true;
          if (Array.isArray(sch.assignedTutors) && sch.assignedTutors.includes(staffUid)) return true;
          if (Array.isArray(sch.tutors) && sch.tutors.some((t: any) => t.id === staffUid || t.email === currentUser?.email)) return true;
          return true; // Default fallback allowing access to partner school records
        });
        setAssignedSchools(mySchools);
      } catch (e) {
        console.warn('Assigned schools fetch failed:', e);
      }

      // 3. Fetch Wallet and Payment Records from Firebase
      try {
        let staffWalletData: any = null;
        if (staffUid) {
          try {
            const walletDocSnap = await getDoc(doc(db, 'staffWallets', staffUid));
            if (walletDocSnap.exists()) {
              staffWalletData = walletDocSnap.data();
            }
          } catch (e) {
            console.warn('Direct walletDocSnap fetch failed:', e);
          }
        }

        const billingRes = !effective.isMasquerading ? await billingGet<any>('billing-data').catch(() => null) : null;
        const wallet = staffWalletData || billingRes?.wallet || null;
        setWalletBalance(Number(wallet?.availableBalance ?? 0));
        setSavedBankCode(String(wallet?.bankCode || ''));
        setSavedAccountLast4(String(wallet?.bankAccountLast4 || ''));
        setSavedAccountName(String(wallet?.bankAccountName || ''));

        let loadedPayments: any[] = [];
        if (Array.isArray(billingRes?.payments) && billingRes.payments.length > 0) {
          loadedPayments = billingRes.payments;
        } else if (staffUid) {
          const [snap1, snap2] = await Promise.all([
            getDocs(query(collection(db, 'payments'), where('tutorId', '==', staffUid), limit(100))).catch(() => ({ docs: [] } as any)),
            getDocs(query(collection(db, 'payments'), where('userId', '==', staffUid), limit(100))).catch(() => ({ docs: [] } as any))
          ]);
          const seen = new Set<string>();
          [...snap1.docs, ...snap2.docs].forEach(d => {
            if (!seen.has(d.id)) {
              seen.add(d.id);
              loadedPayments.push({ id: d.id, ...d.data() });
            }
          });
        }
        setPayments(loadedPayments);
      } catch (err) {
        console.warn('Billing fetch failed:', err);
        setWalletBalance(0);
        setSavedBankCode('');
        setSavedAccountLast4('');
        setSavedAccountName('');
        setPayments([]);
      }

      // Fetch banks
      try {
        const banksRes = await billingGet<any>('paystack-banks');
        if (banksRes?.banks) setBanksList(banksRes.banks);
      } catch (e) {
        // Handled by default fallback in modal
      }

    } catch (err) {
      console.error('Error loading staff dashboard:', err);
      setErrorMsg('Some workspace data could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();
  }, []);

  const handlePostLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentId || !linkUrl.trim()) return;
    if (!students.some(s => s.id === targetStudentId)) {
      setErrorMsg('That student is not assigned to your workspace.');
      return;
    }
    setSubmittingLink(true);
    setErrorMsg('');
    try {
      await addDoc(collection(db, 'personalLinks'), {
        studentId: targetStudentId,
        title: linkTitle.trim() || 'Class Session Link',
        url: linkUrl.trim(),
        platform: linkPlatform,
        meetingTime: meetingTime.trim(),
        tutorId: auth.currentUser?.uid,
        tutorEmail: auth.currentUser?.email || '',
        createdAt: serverTimestamp()
      });
      setSuccessMsg('Classroom link posted to the assigned student portal successfully.');
      setShowLinkModal(false);
      setLinkTitle('');
      setLinkUrl('');
      setMeetingTime('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error posting link:', err);
      setErrorMsg('Could not publish the classroom link.');
    } finally {
      setSubmittingLink(false);
    }
  };

  const handleConfirmWithdrawal = async (payoutData: {
    destination: 'bank';
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    fee: number;
    netAmount: number;
  }) => {
    try {
      await billingPost('wallet-withdraw', {
        action: 'withdraw',
        amount: payoutData.amount,
        bankCode: payoutData.bankCode,
        bankName: payoutData.bankName,
        accountNumber: payoutData.accountNumber,
        accountName: payoutData.accountName
      });
      toast.success('Withdrawal submitted successfully.');
      fetchStaffData();
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="dashboard-interface space-y-6">
      <SEO 
        title="Staff & Tutor Workspace Dashboard | Jaystarbliss Studios" 
        description="Access assigned students, curriculum documents, lesson schedules, and mentor resources." 
        noindex={true} 
      />

      <DashboardGreeting 
        role="Faculty Mentor" 
        subtitle="Deliver interactive lessons, manage assigned learners, review earnings, and withdraw funds." 
      />

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 dark:text-red-300 text-xs flex items-center gap-3 animate-fadeIn">
          <ShieldCheck size={18} className="text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Mobile-First Modern Fintech Wallet Section */}
      <section aria-label="Staff Earnings and Wallet">
        <FintechWalletCard
          userName={auth.currentUser?.displayName || 'Faculty Member'}
          userRole="staff"
          balance={walletBalance}
          subTitleText="Teaching Roster • Active students"
          subTitleValue={`${students.length} Learners`}
          latestTransaction={payments[0] || null}
          onRefresh={fetchStaffData}
          onViewTransactionHistory={() => {
            const el = document.getElementById('staff-tx-history');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          onWithdraw={() => setIsWithdrawModalOpen(true)}
        />
      </section>

      {/* Quick Summary Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="pro-surface p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Assigned Students</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{students.length}</p>
          </div>
        </div>

        <div className="pro-surface p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Curriculum Guides</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{resources.length}</p>
          </div>
        </div>


      </div>

      {/* 2. Assigned Students Management */}
      <div className="pro-surface rounded-3xl p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              My Assigned Students
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Only learners assigned to your mentor profile appear in your workspace.
            </p>
          </div>
          <span className="self-start sm:self-auto text-xs font-black px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {students.length} Assigned
          </span>
        </div>

        {loading ? (
          <div className="text-xs text-slate-500 py-6">Loading assigned student roster...</div>
        ) : students.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">No students assigned yet</p>
            <p className="text-xs text-slate-500 mt-1">
              An administrator will link students to your staff account for active mentoring.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map(st => (
              <div 
                key={st.id} 
                className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col justify-between hover:border-brand-red/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                      {st.fullName || st.studentName || 'Student'}
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                      Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    @{st.username || 'Student'} • {st.email || 'No email'}
                  </p>
                  <div className="mt-3 text-xs">
                    <span className="text-slate-400 block mb-0.5 text-[10px] uppercase font-bold">Track / Track Plan:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{st.plan || 'Practical Learning Track'}</span>
                  </div>
                  {st.schedule && (
                    <div className="mt-2 text-xs text-brand-red font-bold flex items-center gap-1">
                      <Clock size={12} /> {st.schedule}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <Link 
                    to={`/portal/staff/students/${st.id}`} 
                    className="text-xs font-black text-brand-red hover:underline flex items-center gap-1"
                  >
                    <span>Open Student Workspace</span>
                    <ArrowRight size={13} />
                  </Link>
                  <button 
                    type="button" 
                    onClick={() => { setTargetStudentId(st.id); setShowLinkModal(true); }} 
                    className="min-h-8 px-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 transition-all"
                  >
                    <Video size={13} className="text-brand-red" />
                    <span>Live Link</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Class Schedules & Live Attendance Tracking */}
      <div className="pro-surface rounded-3xl p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <StaffClassSchedulesManager
          tutorId={auth.currentUser?.uid}
          tutorName={auth.currentUser?.displayName || 'Faculty Member'}
          assignedSchools={assignedSchools}
          assignedStudents={students}
        />
      </div>

      {/* 4. Transaction History & Receipts Downloader Section */}
      <div id="staff-tx-history" className="pt-2">
        <FintechTransactionHistory
          transactions={payments}
          title="Teaching Payouts & Settlement History"
          role="staff"
          emptyMessage="No tuition records currently linked to your teaching roster"
        />
      </div>

      {/* 4. Curriculum Guides & Teaching Documents (List Format) */}
      <div id="staff-curriculum-resources" className="pt-2">
        <ResourceListView
          resources={resources}
          role="staff"
          title="Staff Curriculum & Teaching Documents"
          onPreview={(item) => {
            const url = item.url || item.fileUrl;
            if (url) window.open(url, '_blank');
          }}
          emptyMessage="No teaching documents currently uploaded."
        />
      </div>

      {/* Broadcast Live Class Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
              Post Live Class Link
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Broadcast a Google Meet, Zoom, or Scratch link directly to the student portal.
            </p>
            <form onSubmit={handlePostLink} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Select Student</label>
                <select 
                  required 
                  value={targetStudentId} 
                  onChange={e => setTargetStudentId(e.target.value)} 
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.fullName || s.studentName || s.username}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Session Title</label>
                <input 
                  type="text" 
                  value={linkTitle} 
                  onChange={e => setLinkTitle(e.target.value)} 
                  placeholder="e.g. Python Loops & AI Logic Live Session" 
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Platform</label>
                <select 
                  value={linkPlatform} 
                  onChange={e => setLinkPlatform(e.target.value)} 
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                >
                  <option>Google Meet</option>
                  <option>Zoom Meeting</option>
                  <option>Microsoft Teams</option>
                  <option>Scratch Live Session</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Meeting URL</label>
                <input 
                  type="url" 
                  required 
                  value={linkUrl} 
                  onChange={e => setLinkUrl(e.target.value)} 
                  placeholder="https://meet.google.com/xxx-xxxx-xxx" 
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Meeting Time / Schedule (Optional)</label>
                <input 
                  type="text" 
                  value={meetingTime} 
                  onChange={e => setMeetingTime(e.target.value)} 
                  placeholder="e.g. Today at 4:30 PM WAT" 
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowLinkModal(false)} 
                  className="min-h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submittingLink} 
                  className="min-h-10 px-4 bg-brand-red text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors"
                >
                  {submittingLink ? 'Publishing...' : 'Publish to Student Portal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fintech Withdrawal Modal */}
      <FintechWithdrawalModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        availableBalance={walletBalance}
        initialMode="bank"
        savedBankCode={savedBankCode}
        savedAccountLast4={savedAccountLast4}
        savedAccountName={savedAccountName}
        banksList={banksList}
        onConfirmWithdrawal={handleConfirmWithdrawal}
      />

    </div>
  );
};

export default StaffDashboard;
