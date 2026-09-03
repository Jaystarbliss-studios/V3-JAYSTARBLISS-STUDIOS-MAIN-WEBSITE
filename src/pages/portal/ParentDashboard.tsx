import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { 
  collection, getDocs, addDoc, serverTimestamp, query, where 
} from 'firebase/firestore';
import { 
  GraduationCap, PlusCircle, CreditCard, 
  Bell, CheckCircle2, Clock, Award
} from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { AchievementBadge, PRESET_ACHIEVEMENTS, type AchievementBadgeData } from '../../components/ecosystem/AchievementBadge';
import { DashboardGreeting } from '../../components/portal/DashboardGreeting';

const ParentDashboard: React.FC = () => {
  const [children, setChildren] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Enroll Child Modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('Standard Weekend Coding');
  const [preferredSubjects, setPreferredSubjects] = useState('Scratch, Python, Web Development');
  const [submitting, setSubmitting] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState('');

  useEffect(() => {
    const fetchParentData = async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userEmail = user.email ? user.email.toLowerCase() : '';
        const userUid = user.uid;

        // 1. Fetch Students from individualStudents & students collections
        const allStudentsMap = new Map<string, any>();

        // Query individualStudents
        try {
          const studentQueries = [
            query(collection(db, 'individualStudents'), where('parentId', '==', userUid)),
            ...(userEmail ? [query(collection(db, 'individualStudents'), where('parentId', '==', userEmail))] : [])
          ];
          const studentSnaps = await Promise.all(studentQueries);
          studentSnaps.forEach(isSnap => isSnap.docs.forEach(d => {
            allStudentsMap.set(d.id, { id: d.id, ...d.data() });
          }));
        } catch (e) {
          console.warn('individualStudents query error:', e);
        }

        // Query legacy students
        try {
          const legacyQueries = [
            query(collection(db, 'students'), where('parentId', '==', userUid)),
            ...(userEmail ? [query(collection(db, 'students'), where('parentId', '==', userEmail))] : [])
          ];
          const legacySnaps = await Promise.all(legacyQueries);
          legacySnaps.forEach(sSnap => sSnap.docs.forEach(d => {
            if (!allStudentsMap.has(d.id)) allStudentsMap.set(d.id, { id: d.id, ...d.data() });
          }));
        } catch (e) {
          console.warn('students query error:', e);
        }

        setChildren(Array.from(allStudentsMap.values()));

        // 2. Fetch Payments
        try {
          const pSnap = await getDocs(query(collection(db, 'payments'), where('parentId', '==', userUid)));
          const pList: any[] = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setPayments(pList);
        } catch (e) {
          console.warn('Payments fetch error:', e);
        }

        // 3. Fetch Pending Enrollment Requests
        try {
          const eSnap = await getDocs(query(collection(db, 'enrollment_requests'), where('parentId', '==', userUid)));
          const eList: any[] = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setEnrollments(eList);
        } catch (e) {
          console.warn('Enrollment requests fetch error:', e);
        }

        // 4. Fetch Announcements / Notifications
        try {
          const nSnap = await getDocs(query(collection(db, 'notifications'), where('recipientId', 'in', [userUid, userEmail, 'all'])));
          setNotifications(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.warn('Notifications fetch error:', e);
        }

      } catch (err) {
        console.error('Error fetching parent data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchParentData();
  }, []);

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setEnrollSuccess('');

    try {
      const user = auth.currentUser;
      const payload = {
        studentName: studentName.trim(),
        studentAge: studentAge.trim(),
        plan: selectedPlan,
        subjects: preferredSubjects.split(',').map(s => s.trim()),
        parentId: user?.uid || 'anonymous',
        parentEmail: user?.email || '',
        parentName: user?.displayName || sessionStorage.getItem('userName') || '',
        status: 'PENDING_REVIEW',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'enrollment_requests'), payload);
      await addDoc(collection(db, 'student_requests'), payload);

      setEnrollments(prev => [{ id: docRef.id, ...payload }, ...prev]);
      setEnrollSuccess(`Enrollment request submitted for ${studentName}! Our admissions team will review and assign an instructor.`);
      setStudentName('');
      setStudentAge('');
      setShowEnrollModal(false);
    } catch (err: any) {
      console.error('Error submitting enrollment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-interface space-y-8">
      <SEO 
        title="Parent Portal & Progress Dashboard" 
        description="Monitor child progress, attendance, mentor assessments, and billing at Jaystarbliss Studios." 
        noindex={true}
      />

      {/* Dynamic Timezone Greeting Banner */}
      <DashboardGreeting 
        name="Parent & Guardian Console"
        role="Parent / Guardian"
        subtitle="Track your child's weekly coding milestones, access codes, mentor notes, and tuition statements."
      />

      {enrollSuccess && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 text-green-800 dark:text-green-300 text-sm flex items-center gap-3">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
          {enrollSuccess}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="pro-surface p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Linked Children</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{children.length}</p>
          </div>
        </div>

        <div className="pro-surface p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-red/10 text-brand-red rounded-xl flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Pending Enrollments</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{enrollments.length}</p>
          </div>
        </div>

        <div className="pro-surface p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tuition Receipts</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{payments.length}</p>
          </div>
        </div>
      </div>

      {/* Linked Children Profiles */}
      <div className="pro-surface rounded-3xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Enrolled Cadets</h2>
          <button 
            type="button" 
            onClick={() => setShowEnrollModal(true)}
            className="text-xs font-bold text-brand-red hover:underline flex items-center gap-1"
          >
            <PlusCircle size={14} /> Add Student
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 py-6">Loading student records...</div>
        ) : children.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl bg-gray-50/50 dark:bg-slate-900/40">
            <GraduationCap className="mx-auto h-12 w-12 text-gray-300 dark:text-slate-600 mb-3" />
            <p className="font-bold text-gray-900 dark:text-white">No cadets linked yet</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              If you recently enrolled, your account will link automatically once verified. Or request enrollment below.
            </p>
            <button 
              type="button" 
              onClick={() => setShowEnrollModal(true)}
              className="mt-4 px-4 py-2 bg-brand-red text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors shadow-xs"
            >
              Request Child Enrollment
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children.map(student => (
              <div key={student.id} className="border border-gray-200/80 dark:border-white/5 rounded-2xl p-5 bg-gray-50/50 dark:bg-slate-900/60 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-red text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {student.fullName?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">{student.fullName}</h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400">@{student.username || 'cadet'}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                      Active
                    </span>
                  </div>

                  <div className="space-y-2 mt-4 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-slate-400 block mb-1">Enrolled Subjects:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(student.subjects) ? student.subjects.map((sub: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-gray-700 dark:text-slate-300">
                            {sub}
                          </span>
                        )) : (
                          <span className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-gray-700 dark:text-slate-300">
                            {student.subjects || 'General Tech Track'}
                          </span>
                        )}
                      </div>
                    </div>

                    {student.schedule && (
                      <div className="pt-2 text-gray-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Clock size={12} className="text-brand-red" /> {student.schedule}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-200 dark:border-white/5 flex justify-between items-center text-xs">
                  <span className="text-gray-500 dark:text-slate-400">
                    Access Code: <strong className="font-mono text-brand-red ml-1">{student.accessCode || '******'}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student Achievements & Mastery Badges Showcase for Parents */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Award size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Student Achievements & Certifications</h3>
              <p className="text-xs text-slate-500">Track and celebrate tangible skills earned by your children across the 5-stage framework.</p>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            {PRESET_ACHIEVEMENTS.filter((b: AchievementBadgeData) => b.unlockedAt).length} Badges Earned
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRESET_ACHIEVEMENTS.slice(0, 4).map((badge: AchievementBadgeData) => (
            <AchievementBadge key={badge.id} badge={badge} />
          ))}
        </div>
      </div>

      {/* Tuition & Announcements Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Tuition Statements */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-brand-red" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Tuition & Billing Statements</h3>
          </div>

          {payments.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No past invoices on record.</p>
          ) : (
            <div className="space-y-3">
              {payments.map(p => (
                <div key={p.id} className="p-3.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{p.description || p.plan || 'Tuition Payment'}</div>
                    <div className="text-gray-500">{p.studentName || 'Cadet'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-brand-slate dark:text-white">₦{p.amount?.toLocaleString() || p.amount}</div>
                    <span className="text-[10px] font-bold text-green-600 uppercase">Paid</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notices & Announcements */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-brand-red" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Parent Notices & Alerts</h3>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No active notices.</p>
          ) : (
            <div className="space-y-3">
              {notifications.slice(0, 4).map(n => (
                <div key={n.id} className="p-3.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-xs">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-1">{n.title}</h4>
                  <p className="text-gray-600 dark:text-gray-300">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Modal for Enrolling New Child */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-gray-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Enroll New Child</h3>
            <p className="text-xs text-gray-500 mb-4">Submit student details to request class assignment.</p>

            <form onSubmit={handleEnrollSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Student Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="e.g. David Johnson" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Age / Grade</label>
                <input 
                  type="text" 
                  required 
                  value={studentAge}
                  onChange={e => setStudentAge(e.target.value)}
                  placeholder="e.g. 10 years / Grade 5" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Learning Track / Plan</label>
                <select 
                  value={selectedPlan}
                  onChange={e => setSelectedPlan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs"
                >
                  <option value="Standard Weekend Coding">Standard Weekend Coding (Sat 10 AM)</option>
                  <option value="Intensive 1-on-1 Mentorship">Intensive 1-on-1 Mentorship</option>
                  <option value="AI & Robotics Track">AI & Robotics Track</option>
                  <option value="Web & Mobile App Building">Web & Mobile App Building</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Preferred Subjects</label>
                <input 
                  type="text" 
                  value={preferredSubjects}
                  onChange={e => setPreferredSubjects(e.target.value)}
                  placeholder="e.g. Python, Scratch, Robotics" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowEnrollModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-red text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ParentDashboard;
