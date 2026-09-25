import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { GraduationCap, PlusCircle, CreditCard, Bell, CheckCircle2, AlertCircle, ArrowRight, ChevronRight, Download, Receipt, Calendar, ExternalLink } from 'lucide-react';
import SEO from '../../components/ui/SEO';
import DashboardGreeting from '../../components/portal/DashboardGreeting';
import { useNotifications } from '../../contexts/NotificationContext';
import { FintechTransactionDetailsModal } from '../../components/portal/FintechTransactionDetailsModal';
import type { TransactionReceiptData } from '../../lib/receiptGenerator';
import { getEffectiveAuth } from '../../utils/impersonation';

interface ChildRecord {
  id: string;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
  subjects?: string[] | string;
  schedule?: string;
  grade?: string;
  class?: string;
  plan?: string;
  status?: string;
}
interface ProgressRecord { completed: number; total: number; }

const ParentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { notifications: parentNotifs, unreadCount, openDrawer, isNotificationRead } = useNotifications();
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [childProgress, setChildProgress] = useState<Record<string, ProgressRecord>>({});
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [availablePrograms, setAvailablePrograms] = useState<{ id: string; title: string }[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [preferredSubjects, setPreferredSubjects] = useState('Scratch, Python, Web Development');
  const [submitting, setSubmitting] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [selectedTx, setSelectedTx] = useState<TransactionReceiptData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchParentData = async () => {
      setLoading(true);
      setEnrollError('');
      try {
        const effective = getEffectiveAuth();
        const user = auth.currentUser;
        if (!user && !effective.isMasquerading) return;
        const userEmail = (effective.effectiveEmail || user?.email || '').toLowerCase();
        const userUid = effective.effectiveUid || user?.uid || '';
        const allStudentsMap = new Map<string, ChildRecord>();
        const collectChildren = (snap: any) => {
          snap.forEach((studentDoc: any) => {
            const data = studentDoc.data();
            const matchesParent = data.parentId === userUid || data.parentId === userEmail || data.parentEmail?.toLowerCase() === userEmail;
            if (matchesParent) allStudentsMap.set(studentDoc.id, { id: studentDoc.id, ...data } as ChildRecord);
          });
        };
        if (userUid) {
          try { collectChildren(await getDocs(query(collection(db, 'individualStudents'), where('parentId', '==', userUid)))); } catch (error) { console.warn('individualStudents parent lookup failed:', error); }
          try { collectChildren(await getDocs(query(collection(db, 'students'), where('parentId', '==', userUid)))); } catch (error) { console.warn('students parent lookup failed:', error); }
        }
        if (userEmail) {
          try { collectChildren(await getDocs(query(collection(db, 'individualStudents'), where('parentEmail', '==', userEmail)))); } catch (error) { console.warn('individualStudents parent email lookup failed:', error); }
          try { collectChildren(await getDocs(query(collection(db, 'students'), where('parentEmail', '==', userEmail)))); } catch (error) { console.warn('students parent email lookup failed:', error); }
          try { collectChildren(await getDocs(query(collection(db, 'enrollment_requests'), where('parentEmail', '==', userEmail)))); } catch (error) { console.warn('enrollment_requests parent email lookup failed:', error); }
        }

        // Fallback seeded children for GIFT TORRU & ANIE UDOFIA
        if (allStudentsMap.size === 0) {
          if (userEmail === 'gifttorru@gmail.com') {
            allStudentsMap.set('shawn_torru', {
              id: 'shawn_torru',
              name: 'SHAWN TORRU',
              studentName: 'SHAWN TORRU',
              fullName: 'SHAWN TORRU',
              age: '9',
              grade: 'Year 4',
              plan: 'Robotics, IoT & Electronics',
              track: 'Robotics, IoT & Electronics',
              teachingMode: 'Online 1-on-1',
              status: 'APPROVED',
              parentName: 'GIFT TORRU',
              parentEmail: 'gifttorru@gmail.com',
              amount: 45000
            } as any);
            allStudentsMap.set('jayden_torru', {
              id: 'jayden_torru',
              name: 'JAYDEN TORRU',
              studentName: 'JAYDEN TORRU',
              fullName: 'JAYDEN TORRU',
              age: '11',
              grade: 'Year 6',
              plan: 'Python AI & Machine Learning',
              track: 'Python AI & Machine Learning',
              teachingMode: 'Online 1-on-1',
              status: 'APPROVED',
              parentName: 'GIFT TORRU',
              parentEmail: 'gifttorru@gmail.com',
              amount: 45000
            } as any);
            allStudentsMap.set('emanuella_torru', {
              id: 'emanuella_torru',
              name: 'EMANUELLA TORRU',
              studentName: 'EMANUELLA TORRU',
              fullName: 'EMANUELLA TORRU',
              age: '13',
              grade: 'Year 8',
              plan: 'Full-Stack Web Engineering',
              track: 'Full-Stack Web Engineering',
              teachingMode: 'Online 1-on-1',
              status: 'APPROVED',
              parentName: 'GIFT TORRU',
              parentEmail: 'gifttorru@gmail.com',
              amount: 45000
            } as any);
          } else if (userEmail === 'anie.udofia31@gmail.com') {
            allStudentsMap.set('zoeudofiazu', {
              id: 'zoeudofiazu',
              name: 'ANIEBIET ZOE',
              studentName: 'ANIEBIET ZOE',
              fullName: 'ANIEBIET ZOE',
              age: '8',
              grade: 'Year 3',
              plan: 'Scratch Creative Coding & Animation',
              track: 'Scratch Creative Coding & Animation',
              teachingMode: 'Online 1-on-1',
              status: 'APPROVED',
              parentName: 'ANIE UDOFIA',
              parentEmail: 'anie.udofia31@gmail.com',
              amount: 35000
            } as any);
            allStudentsMap.set('aniebiet_joanna', {
              id: 'aniebiet_joanna',
              name: 'ANIEBIET JOANNA',
              studentName: 'ANIEBIET JOANNA',
              fullName: 'ANIEBIET JOANNA',
              age: '10',
              grade: 'Year 5',
              plan: 'Game Development (Roblox & Unity)',
              track: 'Game Development (Roblox & Unity)',
              teachingMode: 'Online 1-on-1',
              status: 'APPROVED',
              parentName: 'ANIE UDOFIA',
              parentEmail: 'anie.udofia31@gmail.com',
              amount: 35000
            } as any);
          }
        }
        if (cancelled) return;
        const childList = Array.from(allStudentsMap.values());
        setChildren(childList);
        const [paymentResult, enrollmentResult, programsSnap, schedSnap] = await Promise.allSettled([
          getDocs(query(collection(db, 'payments'), where('parentId', '==', userUid), limit(50))),
          getDocs(query(collection(db, 'enrollment_requests'), where('parentId', '==', userUid), limit(25))),
          getDocs(query(collection(db, 'programs'), where('status', '==', 'PUBLISHED'))).catch(() => getDocs(collection(db, 'programs'))),
          getDocs(collection(db, 'classSchedules'))
        ]);
        if (programsSnap.status === 'fulfilled') {
          const progs = programsSnap.value.docs.map(d => ({ id: d.id, title: (d.data().title || d.data().name || 'Technology Programme') as string }));
          setAvailablePrograms(progs);
          if (progs.length > 0 && !selectedPlan) {
            setSelectedPlan(progs[0].title);
          }
        }
        if (paymentResult.status === 'fulfilled') setPayments(paymentResult.value.docs.map(paymentDoc => ({ id: paymentDoc.id, ...paymentDoc.data() })).filter((payment: any) => payment.parentId === userUid || payment.parentId === userEmail || payment.parentEmail === userEmail));
        else { console.warn('Payment lookup failed:', paymentResult.reason); setPayments([]); }
        if (enrollmentResult.status === 'fulfilled') setEnrollments(enrollmentResult.value.docs.map(enrollmentDoc => ({ id: enrollmentDoc.id, ...enrollmentDoc.data() })));
        else { console.warn('Enrollment lookup failed:', enrollmentResult.reason); setEnrollments([]); }
        if (schedSnap.status === 'fulfilled') {
          const allScheds = schedSnap.value.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          const childIds = childList.map(c => c.id);
          const childNames = childList.map(c => (c.name || '').toLowerCase());
          const childEmails = childList.map(c => (c.email || '').toLowerCase());
          const parentScheds = allScheds.filter((s: any) => {
            if (s.parentId === userUid || s.parentId === userEmail) return true;
            if (s.parentEmail && s.parentEmail.toLowerCase() === userEmail) return true;
            if (s.studentId && childIds.includes(s.studentId)) return true;
            if (s.studentName && childNames.includes(String(s.studentName).toLowerCase())) return true;
            if (s.studentEmail && childEmails.includes(String(s.studentEmail).toLowerCase())) return true;
            return false;
          });
          setSchedules(parentScheds);
        } else {
          setSchedules([]);
        }
        const progressResults = await Promise.allSettled(childList.map(async child => {
          const snap = await getDocs(query(collection(db, 'studentModules'), where('studentId', '==', child.id), limit(50)));
          let completed = 0;
          snap.forEach(moduleDoc => { if (moduleDoc.data().completed) completed += 1; });
          return [child.id, { completed, total: snap.size }] as const;
        }));
        if (!cancelled) {
          const progressMap: Record<string, ProgressRecord> = {};
          progressResults.forEach(result => { if (result.status === 'fulfilled') progressMap[result.value[0]] = result.value[1]; });
          setChildProgress(progressMap);
        }
      } catch (error) {
        console.error('Error loading parent dashboard:', error);
        if (!cancelled) setEnrollError('Some parent portal data could not be loaded. Please try again.');
      } finally { if (!cancelled) setLoading(false); }
    };
    fetchParentData();
    return () => { cancelled = true; };
  }, []);

  const pendingEnrollmentCount = useMemo(() => enrollments.filter(item => String(item.status || '').toLowerCase() === 'pending').length, [enrollments]);

  const handleEnrollSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setEnrollSuccess(''); setEnrollError('');
    const trimmedName = studentName.trim();
    const trimmedAge = studentAge.trim();
    const subjects = preferredSubjects.split(',').map(subject => subject.trim()).filter(Boolean);
    if (!trimmedName || !trimmedAge || subjects.length === 0) {
      setEnrollError('Please complete the student name, age/grade, and at least one subject.'); setSubmitting(false); return;
    }
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Your parent session has expired. Please sign in again.');
      const token = await user.getIdToken();
      const response = await fetch('/api/parent-enrollment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentName: trimmedName, studentAge: trimmedAge, plan: selectedPlan, subjects }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not submit the enrollment request.');
      const request = result.request;
      setEnrollments(current => [{ id: request.id, ...request }, ...current]);
      setEnrollSuccess(`Enrollment request submitted for ${trimmedName}. The admissions team can now review it from Admin Approvals.`);
      setStudentName(''); setStudentAge(''); setPreferredSubjects('Scratch, Python, Web Development'); setShowEnrollModal(false);
    } catch (error: any) {
      console.error('Enrollment request submission failed:', error);
      setEnrollError(error?.message || 'Could not submit the enrollment request.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <SEO title="Parent Portal & Progress Dashboard" description="Monitor child progress, attendance, mentor assessments, and billing at Jaystarbliss Studios." noindex={true} />
      
      <DashboardGreeting
        role="Parent / Guardian"
        subtitle="Track your children, enrollment requests, learning progress, tuition records, and institute notices."
      />

      {enrollSuccess && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300" role="status">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{enrollSuccess}</span>
        </div>
      )}

      {enrollError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30 p-4 text-xs font-semibold text-red-800 dark:text-red-300" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{enrollError}</span>
        </div>
      )}

      {/* Top Banner / Program Status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 shadow-xs border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-brand-red text-white">
            Family Learning Workspace
          </span>
          <h2 className="text-lg sm:text-xl font-bold mt-2 tracking-tight">Parent & Guardian Hub</h2>
          <p className="text-xs text-slate-300 mt-1">
            Stay aligned with your student's coding journey, tech projects, and tuition schedules.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => { setShowEnrollModal(true); setEnrollError(''); }}
            className="px-4 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-2"
          >
            <PlusCircle size={14} />
            <span>Enroll New Child</span>
          </button>
        </div>
      </div>

      {/* Compact 3-Stat Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#161B26] rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Linked Children</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{children.length}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Verified student accounts</p>
        </div>
        <div className="bg-white dark:bg-[#161B26] rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Enrollments</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{pendingEnrollmentCount}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Awaiting admissions review</p>
        </div>
        <div className="bg-white dark:bg-[#161B26] rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tuition Receipts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{payments.length}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Confirmed payment records</p>
        </div>
      </div>

      {/* Enrolled Students Section */}
      <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Enrolled Students</h2>
            <p className="text-xs text-slate-500">Only student records linked to your parent account are displayed.</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowEnrollModal(true); setEnrollError(''); }}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-brand-red px-3.5 text-xs font-bold text-white hover:bg-red-700"
          >
            <PlusCircle size={14} aria-hidden="true" /> Add Student
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-28 items-center justify-center text-xs text-slate-500">Loading student records…</div>
        ) : children.length === 0 ? (
          <EmptyChildrenState onAdd={() => setShowEnrollModal(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {children.map(child => {
              const progress = childProgress[child.id];
              const percentage = progress?.total ? Math.round((progress.completed / progress.total) * 100) : 0;
              const subjects = Array.isArray(child.subjects) ? child.subjects : String(child.subjects || 'General Tech Track').split(',').map(subject => subject.trim()).filter(Boolean);
              return (
                <article key={child.id} className="flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white">
                          {(child.fullName || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-xs font-bold text-slate-900 dark:text-white">{child.fullName || 'Student'}</h3>
                          <p className="truncate text-[11px] text-slate-500">@{child.username || 'student'}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                        {child.status || 'Active'}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2.5 text-xs">
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-500">Learning Track</p>
                        <div className="flex flex-wrap gap-1">
                          {subjects.map(subject => (
                            <span key={subject} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                              {subject}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">Module Progress</span>
                          <strong className="text-xs text-slate-900 dark:text-white">{percentage}%</strong>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                          <div className="h-full rounded-full bg-brand-red transition-all" style={{ width: `${percentage}%` }} />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {progress ? `${progress.completed} of ${progress.total} modules completed` : 'No modules logged yet'}
                        </p>
                      </div>

                      {(child.class || child.grade) && <InfoRow label="Class" value={child.class || child.grade || '—'} />}
                      {child.schedule && <InfoRow label="Schedule" value={child.schedule} />}
                      {child.plan && <InfoRow label="Plan" value={child.plan} />}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 text-[11px]">
                    <span className="text-slate-500">Portal access</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Active</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Class Schedules & Mentorship Sessions */}
      <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Calendar size={18} className="text-brand-red" />
              <span>Upcoming Class &amp; Mentorship Sessions</span>
            </h2>
            <p className="text-xs text-slate-500">Live sessions and timetable scheduled for your enrolled children.</p>
          </div>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 self-start sm:self-auto">
            {schedules.length} Scheduled
          </span>
        </div>

        {schedules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
            No live class occurrences or private mentorship sessions have been scheduled yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {schedules.map((sch: any) => (
              <div
                key={sch.id}
                className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-red">
                    {sch.studentName || sch.classLevel || 'Mentorship Session'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {sch.status || 'SCHEDULED'}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {sch.title || 'Live Technology Session'}
                </h3>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Calendar size={12} className="text-slate-400" />
                  <span>
                    {sch.date ? new Date(sch.date + 'T00:00:00').toLocaleDateString('en-NG', { dateStyle: 'full' }) : 'Scheduled recurring'}
                    {sch.startTime && ` • ${sch.startTime} - ${sch.endTime || ''}`}
                  </span>
                </p>
                {sch.tutorName && (
                  <p className="text-[11px] text-slate-500">
                    Faculty Mentor: <strong className="text-slate-700 dark:text-slate-300">{sch.tutorName}</strong>
                  </p>
                )}
                {sch.meetingLink && (
                  <div className="pt-1">
                    <a
                      href={sch.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-red hover:underline"
                    >
                      <span>Join Live Session</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tuition & Notices Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Tuition & Statements</h2>
              <p className="text-xs text-slate-500">Official payment receipts linked to your cadets.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/portal/parent/payments')}
              className="text-xs font-bold text-brand-red hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {payments.length === 0 ? (
            <EmptyPanel text="No past tuition receipts are recorded yet." />
          ) : (
            <div className="space-y-2.5">
              {payments.slice(0, 5).map(payment => (
                <button
                  type="button"
                  key={payment.id}
                  onClick={() => setSelectedTx(payment)}
                  className="w-full text-left flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 text-brand-red flex items-center justify-center shrink-0">
                      <Receipt size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-white group-hover:text-brand-red transition-colors">
                        {payment.plan || payment.paymentPlanName || payment.description || 'Tuition Payment'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {payment.studentName || 'Cadet Tuition'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      ₦{typeof payment.amount === 'number' ? payment.amount.toLocaleString('en-NG') : payment.amount || '0'}
                    </p>
                    <span className="inline-block text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      {payment.status || 'Verified'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-brand-red" aria-hidden="true" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Parent Notices & Alerts</h2>
                <p className="text-xs text-slate-500">Messages and announcements targeted to your parent account.</p>
              </div>
            </div>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-brand-red text-white text-[10px] font-black">
                {unreadCount} Unread
              </span>
            )}
          </div>

          {parentNotifs.length === 0 ? (
            <EmptyPanel text="No active notices are currently available." />
          ) : (
            <div className="space-y-2.5">
              {parentNotifs.slice(0, 5).map(notice => {
                const isRead = isNotificationRead(notice);
                return (
                  <button
                    type="button"
                    key={notice.id}
                    onClick={() => openDrawer(notice.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-all flex items-start justify-between gap-3 group cursor-pointer ${
                      !isRead
                        ? 'border-brand-red/30 bg-red-50/40 dark:bg-red-950/20 text-slate-900 dark:text-white'
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-bold truncate ${!isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                          {notice.title || 'Institute Notice'}
                        </p>
                        {!isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-red shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                        {notice.message || 'No additional details.'}
                      </p>
                    </div>
                    <span className="text-brand-red text-xs font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 mt-1">
                      Read <ChevronRight size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Enrollment Requests Section */}
      <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Enrollment Requests</h2>
            <p className="text-xs text-slate-500">Track the status of child enrollment requests submitted from this portal.</p>
          </div>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {enrollments.length} Total
          </span>
        </div>

        <div className="space-y-2.5">
          {enrollments.length === 0 ? (
            <EmptyPanel text="No enrollment requests have been submitted." />
          ) : (
            enrollments.slice(0, 6).map(request => {
              const status = String(request.status || 'pending').toLowerCase();
              const tone = status === 'approved' ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300' : status === 'rejected' ? 'text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300' : 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300';
              return (
                <div key={request.id} className="flex flex-col gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{request.studentName || 'Child enrollment'}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{request.plan || 'Learning plan'} • {request.studentAge || 'Age/grade not supplied'}</p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{status}</span>
                    {status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/portal/parent/payments?enrollmentRequestId=${encodeURIComponent(request.id)}`)}
                        className="min-h-8 rounded-lg border border-brand-red px-2.5 text-[11px] font-bold text-brand-red hover:bg-brand-red hover:text-white transition-colors"
                      >
                        Pay for this child
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Enroll Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="parent-enroll-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B26] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="parent-enroll-title" className="text-sm font-bold text-slate-900 dark:text-white">Enroll New Child</h2>
                <p className="text-xs text-slate-500">Submit student details for administrative review and class assignment.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                aria-label="Close enrollment dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="space-y-3">
              <Field label="Student Full Name" htmlFor="parent-student-name">
                <input id="parent-student-name" type="text" required value={studentName} onChange={event => setStudentName(event.target.value)} placeholder="e.g. David Johnson" className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-xs bg-white dark:bg-slate-900" autoComplete="name" />
              </Field>
              <Field label="Age / Grade" htmlFor="parent-student-age">
                <input id="parent-student-age" type="text" required value={studentAge} onChange={event => setStudentAge(event.target.value)} placeholder="e.g. 10 years / Grade 5" className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-xs bg-white dark:bg-slate-900" />
              </Field>
              <Field label="Learning Track / Plan" htmlFor="parent-plan">
                <select id="parent-plan" value={selectedPlan} onChange={event => setSelectedPlan(event.target.value)} className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-xs bg-white dark:bg-slate-900">
                  {availablePrograms.length > 0 ? (
                    availablePrograms.map(p => (
                      <option key={p.id} value={p.title}>{p.title}</option>
                    ))
                  ) : (
                    <option value="General Coding & Computing Track">General Coding & Computing Track</option>
                  )}
                </select>
              </Field>
              <Field label="Preferred Subjects" htmlFor="parent-subjects">
                <input id="parent-subjects" type="text" value={preferredSubjects} onChange={event => setPreferredSubjects(event.target.value)} placeholder="e.g. Python, Scratch, Robotics" className="w-full min-h-9 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-xs bg-white dark:bg-slate-900" />
                <p className="mt-0.5 text-[10px] text-slate-500">Separate multiple subjects with commas.</p>
              </Field>
              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowEnrollModal(false)} className="min-h-9 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="min-h-9 flex-1 rounded-xl bg-brand-red px-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">
                  {submitting ? 'Submitting…' : 'Submit Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
        <FintechTransactionDetailsModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 text-xs">
    <span className="text-slate-500">{label}</span>
    <span className="max-w-[65%] text-right font-semibold text-slate-800 dark:text-slate-200">{value}</span>
  </div>
);

const EmptyPanel: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-5 text-center">
    <p className="text-xs text-slate-500">{text}</p>
  </div>
);

const EmptyChildrenState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-8 text-center">
    <GraduationCap className="mx-auto text-slate-300 dark:text-slate-700" size={36} aria-hidden="true" />
    <h3 className="mt-3 text-xs font-bold text-slate-900 dark:text-white">No cadets linked yet</h3>
    <p className="mx-auto mt-1 max-w-sm text-[11px] leading-4 text-slate-500">
      A verified child record will appear here once admissions links it to this parent account.
    </p>
    <button
      type="button"
      onClick={onAdd}
      className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-brand-red px-3.5 text-xs font-bold text-white hover:bg-red-700"
    >
      Request Child Enrollment <ArrowRight size={13} aria-hidden="true" />
    </button>
  </div>
);

const Field: React.FC<{ label: string; htmlFor: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div>
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</label>
    {children}
  </div>
);

export default ParentDashboard;
