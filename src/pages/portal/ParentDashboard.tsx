import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../../lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  limit,
} from 'firebase/firestore';
import {
  GraduationCap,
  PlusCircle,
  CreditCard,
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { DashboardGreeting } from '../../components/portal/DashboardGreeting';

interface ChildRecord {
  id: string;
  fullName?: string;
  username?: string;
  email?: string;
  subjects?: string[] | string;
  schedule?: string;
  accessCode?: string;
  grade?: string;
  class?: string;
  plan?: string;
  status?: string;
}

interface ProgressRecord {
  completed: number;
  total: number;
}

const ParentDashboard: React.FC = () => {
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [childProgress, setChildProgress] = useState<Record<string, ProgressRecord>>({});
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('Standard Weekend Coding');
  const [preferredSubjects, setPreferredSubjects] = useState('Scratch, Python, Web Development');
  const [submitting, setSubmitting] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState('');
  const [enrollError, setEnrollError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchParentData = async () => {
      setLoading(true);
      setEnrollError('');
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userEmail = user.email?.toLowerCase() || '';
        const userUid = user.uid;
        const allStudentsMap = new Map<string, ChildRecord>();

        const collectChildren = (snap: any) => {
          snap.forEach((studentDoc: any) => {
            const data = studentDoc.data();
            const matchesParent =
              data.parentId === userUid ||
              data.parentId === userEmail ||
              data.parentEmail?.toLowerCase() === userEmail;
            if (matchesParent) {
              allStudentsMap.set(studentDoc.id, { id: studentDoc.id, ...data } as ChildRecord);
            }
          });
        };

        try {
          collectChildren(await getDocs(query(collection(db, 'individualStudents'), where('parentId', '==', userUid))));
        } catch (error) {
          console.warn('individualStudents parent lookup failed:', error);
        }

        try {
          collectChildren(await getDocs(query(collection(db, 'students'), where('parentId', '==', userUid))));
        } catch (error) {
          console.warn('students parent lookup failed:', error);
        }

        if (cancelled) return;
        const childList = Array.from(allStudentsMap.values());
        setChildren(childList);

        const [paymentResult, enrollmentResult, notificationResults] = await Promise.allSettled([
          getDocs(query(collection(db, 'payments'), where('parentId', '==', userUid), limit(50))),
          getDocs(query(collection(db, 'enrollment_requests'), where('parentId', '==', userUid), limit(25))),
          Promise.all([
            getDocs(query(collection(db, 'notifications'), where('recipientId', '==', userUid), limit(10))),
            getDocs(query(collection(db, 'notifications'), where('recipientId', '==', 'all_parents'), limit(10))),
            getDocs(query(collection(db, 'notifications'), where('recipientId', '==', 'all'), limit(10))),
          ]),
        ]);

        if (paymentResult.status === 'fulfilled') {
          const paymentList: any[] = [];
          paymentResult.value.forEach((paymentDoc) => {
            const data = paymentDoc.data();
            if (data.parentId === userUid || data.parentId === userEmail || data.parentEmail === userEmail) {
              paymentList.push({ id: paymentDoc.id, ...data });
            }
          });
          setPayments(paymentList);
        } else {
          console.warn('Payment lookup failed:', paymentResult.reason);
          setPayments([]);
        }

        if (enrollmentResult.status === 'fulfilled') {
          const enrollmentList = enrollmentResult.value.docs.map((enrollmentDoc) => ({
            id: enrollmentDoc.id,
            ...enrollmentDoc.data(),
          }));
          setEnrollments(enrollmentList);
        } else {
          console.warn('Enrollment lookup failed:', enrollmentResult.reason);
          setEnrollments([]);
        }

        if (notificationResults.status === 'fulfilled') {
          const notificationMap = new Map<string, any>();
          notificationResults.value.forEach((snap) => {
            snap.forEach((notificationDoc) => {
              notificationMap.set(notificationDoc.id, { id: notificationDoc.id, ...notificationDoc.data() });
            });
          });
          setNotifications(Array.from(notificationMap.values()).slice(0, 10));
        } else {
          console.warn('Notification lookup failed:', notificationResults.reason);
          setNotifications([]);
        }

        const progressResults = await Promise.allSettled(
          childList.map(async (child) => {
            const snap = await getDocs(query(collection(db, 'studentModules'), where('studentId', '==', child.id), limit(50)));
            let completed = 0;
            snap.forEach((moduleDoc) => {
              if (moduleDoc.data().completed) completed += 1;
            });
            return [child.id, { completed, total: snap.size }] as const;
          })
        );

        if (!cancelled) {
          const progressMap: Record<string, ProgressRecord> = {};
          progressResults.forEach((result) => {
            if (result.status === 'fulfilled') progressMap[result.value[0]] = result.value[1];
          });
          setChildProgress(progressMap);
        }
      } catch (error) {
        console.error('Error loading parent dashboard:', error);
        if (!cancelled) setEnrollError('Some parent portal data could not be loaded. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchParentData();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingEnrollmentCount = useMemo(
    () => enrollments.filter((item) => String(item.status || '').toLowerCase() === 'pending').length,
    [enrollments]
  );

  const handleEnrollSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setEnrollSuccess('');
    setEnrollError('');

    const trimmedName = studentName.trim();
    const trimmedAge = studentAge.trim();
    const subjects = preferredSubjects
      .split(',')
      .map((subject) => subject.trim())
      .filter(Boolean);

    if (!trimmedName || !trimmedAge || subjects.length === 0) {
      setEnrollError('Please complete the student name, age/grade, and at least one subject.');
      setSubmitting(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Your parent session has expired. Please sign in again.');

      const payload = {
        studentName: trimmedName,
        studentAge: trimmedAge,
        plan: selectedPlan,
        subjects,
        parentId: user.uid,
        parentEmail: user.email || '',
        parentName: user.displayName || sessionStorage.getItem('userName') || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'enrollment_requests'), payload);
      setEnrollments((current) => [{ id: docRef.id, ...payload }, ...current]);
      setEnrollSuccess(`Enrollment request submitted for ${trimmedName}. The admissions team can now review it from Admin Approvals.`);
      setStudentName('');
      setStudentAge('');
      setPreferredSubjects('Scratch, Python, Web Development');
      setShowEnrollModal(false);
    } catch (error: any) {
      console.error('Enrollment request submission failed:', error);
      setEnrollError(error?.message || 'Could not submit the enrollment request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-interface space-y-6 md:space-y-8">
      <SEO
        title="Parent Portal & Progress Dashboard"
        description="Monitor child progress, attendance, mentor assessments, and billing at Jaystarbliss Studios."
        noindex={true}
      />

      <DashboardGreeting
        name="Parent & Guardian Console"
        role="Parent / Guardian"
        subtitle="Track your children, enrollment requests, learning progress, tuition records, and institute notices."
      />

      {enrollSuccess && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300" role="status">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{enrollSuccess}</span>
        </div>
      )}
      {enrollError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300" role="alert">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{enrollError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Linked Children" value={children.length} icon={<GraduationCap size={22} />} />
        <MetricCard label="Pending Enrollments" value={pendingEnrollmentCount} icon={<Clock size={22} />} />
        <MetricCard label="Tuition Receipts" value={payments.length} icon={<CreditCard size={22} />} />
      </div>

      <section className="pro-surface rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Enrolled Cadets</h2>
            <p className="mt-1 text-xs text-slate-500">Only student records linked to your parent account are displayed.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowEnrollModal(true);
              setEnrollError('');
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-950"
          >
            <PlusCircle size={15} aria-hidden="true" /> Add Student
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-32 items-center justify-center text-sm text-slate-500">Loading student records…</div>
        ) : children.length === 0 ? (
          <EmptyChildrenState onAdd={() => setShowEnrollModal(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {children.map((child) => {
              const progress = childProgress[child.id];
              const percentage = progress?.total ? Math.round((progress.completed / progress.total) * 100) : 0;
              const subjects = Array.isArray(child.subjects)
                ? child.subjects
                : String(child.subjects || 'General Tech Track').split(',').map((subject) => subject.trim()).filter(Boolean);

              return (
                <article key={child.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red text-sm font-black text-white">
                          {(child.fullName || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black text-slate-900 dark:text-white">{child.fullName || 'Cadet'}</h3>
                          <p className="truncate text-xs text-slate-500">@{child.username || 'cadet'}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {child.status || 'Active'}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3 text-xs">
                      <div>
                        <p className="mb-1 text-slate-500">Learning Subjects</p>
                        <div className="flex flex-wrap gap-1.5">
                          {subjects.map((subject) => (
                            <span key={subject} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {subject}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Learning progress</span>
                          <strong className="text-slate-900 dark:text-white">{percentage}%</strong>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                          <div className="h-full rounded-full bg-brand-red transition-all" style={{ width: `${percentage}%` }} />
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          {progress ? `${progress.completed} of ${progress.total} recorded modules completed` : 'No module progress recorded yet'}
                        </p>
                      </div>

                      {(child.class || child.grade) && <InfoRow label="Class" value={child.class || child.grade || '—'} />}
                      {child.schedule && <InfoRow label="Schedule" value={child.schedule} />}
                      {child.plan && <InfoRow label="Plan" value={child.plan} />}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
                    <span className="text-slate-500">Access Code</span>
                    <span className="font-mono font-bold text-brand-red">{child.accessCode || 'Protected'}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="pro-surface rounded-3xl p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Tuition & Billing</h2>
              <p className="mt-1 text-xs text-slate-500">Payment records linked to this parent account.</p>
            </div>
            <CreditCard size={18} className="text-brand-red" aria-hidden="true" />
          </div>
          {payments.length === 0 ? (
            <EmptyPanel text="No past tuition receipts are recorded yet." />
          ) : (
            <div className="space-y-3">
              {payments.slice(0, 6).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{payment.description || payment.plan || 'Tuition Payment'}</p>
                    <p className="mt-1 text-xs text-slate-500">{payment.studentName || 'Cadet'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">₦{typeof payment.amount === 'number' ? payment.amount.toLocaleString('en-NG') : payment.amount || '0'}</p>
                    <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">{payment.status || 'Paid'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pro-surface rounded-3xl p-6">
          <div className="mb-5 flex items-center gap-2">
            <Bell size={18} className="text-brand-red" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Parent Notices & Alerts</h2>
              <p className="mt-1 text-xs text-slate-500">Messages currently visible to your account.</p>
            </div>
          </div>
          {notifications.length === 0 ? (
            <EmptyPanel text="No active notices are currently available." />
          ) : (
            <div className="space-y-3">
              {notifications.slice(0, 5).map((notice) => (
                <div key={notice.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{notice.title || 'Institute Notice'}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{notice.message || 'No additional details.'}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="pro-surface rounded-3xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Enrollment Requests</h2>
            <p className="mt-1 text-xs text-slate-500">Track the status of child enrollment requests submitted from this portal.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{enrollments.length} Total</span>
        </div>

        <div className="mt-5 space-y-3">
          {enrollments.length === 0 ? (
            <EmptyPanel text="No enrollment requests have been submitted." />
          ) : (
            enrollments.slice(0, 8).map((request) => {
              const status = String(request.status || 'pending').toLowerCase();
              const tone = status === 'approved'
                ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300'
                : status === 'rejected'
                  ? 'text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300'
                  : 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300';
              return (
                <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{request.studentName || 'Child enrollment'}</p>
                    <p className="mt-1 text-xs text-slate-500">{request.plan || 'Learning plan'} · {request.studentAge || 'Age/grade not supplied'}</p>
                  </div>
                  <span className={`self-start rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${tone}`}>{status}</span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="parent-enroll-title">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="parent-enroll-title" className="text-lg font-black text-slate-900 dark:text-white">Enroll New Child</h2>
                <p className="mt-1 text-xs text-slate-500">Submit student details for administrative review and class assignment.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                className="min-h-11 min-w-11 rounded-xl text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-red dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close enrollment dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="mt-6 space-y-4">
              <Field label="Student Full Name" htmlFor="parent-student-name">
                <input id="parent-student-name" type="text" required value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="e.g. David Johnson" className="form-control" autoComplete="name" />
              </Field>
              <Field label="Age / Grade" htmlFor="parent-student-age">
                <input id="parent-student-age" type="text" required value={studentAge} onChange={(event) => setStudentAge(event.target.value)} placeholder="e.g. 10 years / Grade 5" className="form-control" />
              </Field>
              <Field label="Learning Track / Plan" htmlFor="parent-plan">
                <select id="parent-plan" value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)} className="form-control">
                  <option>Standard Weekend Coding</option>
                  <option>Intensive 1-on-1 Mentorship</option>
                  <option>AI & Robotics Track</option>
                  <option>Web & Mobile App Building</option>
                </select>
              </Field>
              <Field label="Preferred Subjects" htmlFor="parent-subjects">
                <input id="parent-subjects" type="text" value={preferredSubjects} onChange={(event) => setPreferredSubjects(event.target.value)} placeholder="e.g. Python, Scratch, Robotics" className="form-control" />
                <p className="mt-1 text-[11px] text-slate-500">Separate multiple subjects with commas.</p>
              </Field>

              <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button type="button" onClick={() => setShowEnrollModal(false)} className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-red dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={submitting} className="min-h-11 flex-1 rounded-xl bg-brand-red px-4 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-900">
                  {submitting ? 'Submitting…' : 'Submit Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="pro-surface rounded-2xl p-5">
    <div className="flex items-center gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">{icon}</div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 dark:border-slate-800">
    <span className="text-slate-500">{label}</span>
    <span className="max-w-[65%] text-right font-semibold text-slate-800 dark:text-slate-200">{value}</span>
  </div>
);

const EmptyPanel: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center dark:border-slate-800 dark:bg-slate-950/50">
    <p className="text-xs text-slate-500">{text}</p>
  </div>
);

const EmptyChildrenState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-950/50">
    <GraduationCap className="mx-auto text-slate-300 dark:text-slate-700" size={42} aria-hidden="true" />
    <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-white">No cadets linked yet</h3>
    <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">A verified child record will appear here once admissions links it to this parent account.</p>
    <button type="button" onClick={onAdd} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-950">
      Request Child Enrollment <ArrowRight size={14} aria-hidden="true" />
    </button>
  </div>
);

const Field: React.FC<{ label: string; htmlFor: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div>
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
    {children}
  </div>
);

export default ParentDashboard;
