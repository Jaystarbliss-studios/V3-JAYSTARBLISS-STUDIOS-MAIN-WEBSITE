import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { 
  Users, FileText, Video, Clock, CheckCircle2, 
  ShieldCheck, ArrowRight, School,
  Sparkles, CreditCard, BookOpen, Key, Calendar
} from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { DashboardGreeting } from '../../components/portal/DashboardGreeting';
import { useToast } from '../../contexts/ToastContext';
import { getEffectiveAuth } from '../../utils/impersonation';

const StaffDashboard: React.FC = () => {
  const { toast } = useToast();
  const [resources, setResources] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [assignedSchools, setAssignedSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPlatform, setLinkPlatform] = useState('Google Meet');
  const [meetingTime, setMeetingTime] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);
  const [successMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchStaffData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const effective = getEffectiveAuth();
      const currentUser = auth.currentUser;
      if (!currentUser && !effective.isMasquerading) return;

      const staffUid = effective.effectiveUid || currentUser?.uid;

      // 1. Fetch Curriculum Resources Count
      try {
        const [staffResSnap, generalResSnap, schoolResSnap] = await Promise.all([
          getDocs(collection(db, 'staffGeneralResources')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'resources')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'schoolResources')).catch(() => ({ docs: [] }))
        ]);
        const combined = [
          ...staffResSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          ...generalResSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          ...schoolResSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        ];
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

      // 3. Fetch assigned schools
      try {
        const schoolsSnap = await getDocs(collection(db, 'schools')).catch(() => ({ docs: [] } as any));
        const allSchools = schoolsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        const mySchools = allSchools.filter((sch: any) => {
          if (!staffUid) return false;
          if (sch.tutorId === staffUid || sch.assignedTutorId === staffUid || sch.assignedStaffId === staffUid) return true;
          if (Array.isArray(sch.assignedTutors) && sch.assignedTutors.includes(staffUid)) return true;
          if (Array.isArray(sch.tutors) && sch.tutors.some((t: any) => t.id === staffUid || t.email === currentUser?.email)) return true;
          return false;
        });
        setAssignedSchools(mySchools);
      } catch (e) {
        console.warn('Assigned schools fetch failed:', e);
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
    if (!targetStudentId || !linkUrl) {
      toast.error('Please select a student and provide a valid URL.');
      return;
    }
    setSubmittingLink(true);
    try {
      const user = auth.currentUser;
      const effective = getEffectiveAuth();
      const staffUid = effective.effectiveUid || user?.uid;
      const targetStudent = students.find(s => s.id === targetStudentId);

      await addDoc(collection(db, 'personalLinks'), {
        title: linkTitle || `${linkPlatform} Class Session`,
        url: linkUrl,
        platform: linkPlatform,
        meetingTime: meetingTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        studentId: targetStudentId,
        studentName: targetStudent?.fullName || targetStudent?.studentName || 'Student',
        tutorId: staffUid,
        tutorName: effective.effectiveName || user?.displayName || 'Faculty Member',
        createdAt: serverTimestamp()
      });

      toast.success('Live class link broadcast to student portal!');
      setShowLinkModal(false);
      setLinkTitle('');
      setLinkUrl('');
      setMeetingTime('');
      setTargetStudentId('');
    } catch (err) {
      console.error('Post link error:', err);
      toast.error('Failed to post live class link.');
    } finally {
      setSubmittingLink(false);
    }
  };

  return (
    <div className="dashboard-interface space-y-6">
      <SEO 
        title="Faculty Workspace Overview | Jaystarbliss Studios" 
        description="Access assigned students, teaching schedules, curriculum materials, and ledger payouts." 
        noindex={true} 
      />

      <DashboardGreeting 
        role="Faculty Mentor" 
        subtitle="Deliver interactive lessons, manage assigned learners, review teaching schedules, and access faculty tools." 
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

      {/* Quick Summary Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="pro-surface p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Assigned Learners</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{loading ? '...' : students.length}</p>
          </div>
        </div>

        <div className="pro-surface p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
            <School size={22} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Partner Schools</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{loading ? '...' : assignedSchools.length}</p>
          </div>
        </div>

        <div className="pro-surface p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 bg-white dark:bg-slate-900 shadow-xs">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Curriculum Library</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{loading ? '...' : resources.length}</p>
          </div>
        </div>
      </div>

      {/* Faculty Command Center Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Class Schedules & Live Classrooms */}
        <div className="pro-surface rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-brand-red/40 transition-all">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-red/10 text-brand-red flex items-center justify-center">
              <Video size={22} />
            </div>
            <h3 className="font-black text-slate-900 dark:text-white text-base">
              Class Schedules & Teaching Roster
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Access your combined daily class schedules, update lesson attendance statuses, and broadcast live virtual meeting rooms.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <Link
              to="/portal/staff/classes"
              className="inline-flex items-center gap-2 text-xs font-black text-brand-red hover:underline"
            >
              <span>Open Class Schedules</span>
              <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Video size={13} className="text-brand-red" />
              <span>Broadcast Link</span>
            </button>
          </div>
        </div>

        {/* Card 2: Faculty Billing & Payout Center */}
        <div className="pro-surface rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-emerald-500/40 transition-all">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CreditCard size={22} />
            </div>
            <h3 className="font-black text-slate-900 dark:text-white text-base">
              Billing Center & Payouts
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Manage your fintech account wallet, submit withdrawal requests, and view detailed teaching settlement history.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/portal/staff/payments"
              className="inline-flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <span>Open Billing Center</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

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
                  required 
                  placeholder="e.g. Python Loops & Conditionals Lab" 
                  value={linkTitle} 
                  onChange={e => setLinkTitle(e.target.value)} 
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Platform</label>
                  <select 
                    value={linkPlatform} 
                    onChange={e => setLinkPlatform(e.target.value)} 
                    className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                  >
                    <option value="Google Meet">Google Meet</option>
                    <option value="Zoom">Zoom</option>
                    <option value="Microsoft Teams">MS Teams</option>
                    <option value="Scratch Classroom">Scratch Studio</option>
                    <option value="Code.org">Code.org</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Scheduled Time</label>
                  <input 
                    type="time" 
                    value={meetingTime} 
                    onChange={e => setMeetingTime(e.target.value)} 
                    className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Meeting / Classroom URL</label>
                <input 
                  type="url" 
                  required 
                  placeholder="https://meet.google.com/xyz-abcd-efg" 
                  value={linkUrl} 
                  onChange={e => setLinkUrl(e.target.value)} 
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowLinkModal(false)} 
                  className="min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submittingLink} 
                  className="min-h-11 px-5 rounded-xl bg-brand-red hover:bg-red-700 font-bold text-white flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submittingLink ? 'Publishing...' : 'Broadcast to Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;
