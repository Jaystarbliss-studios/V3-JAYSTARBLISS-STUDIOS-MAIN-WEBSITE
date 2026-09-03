import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Clock, Trophy, Video, ExternalLink, 
  FileText, Download, Bell, Award, CheckCircle2,
  X, ArrowRight, Lock, Code2, Activity
} from 'lucide-react';
import { 
  collection, query, where, getDocs, doc, getDoc, 
  limit, updateDoc 
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import SEO from '../../components/ui/SEO';
import { AchievementBadgeGrid } from '../../components/ecosystem/AchievementBadge';
import { DashboardGreeting } from '../../components/portal/DashboardGreeting';
import { StudentAnalyticsVisualizer } from '../../components/portal/StudentAnalyticsVisualizer';
import { useToast } from '../../contexts/ToastContext';
import { generateModuleCertificatePdf, type ModuleCertificateData } from '../../lib/certificatePdfGenerator';

interface StudentInfo {
  id?: string;
  fullName?: string;
  username?: string;
  email?: string;
  accessCode?: string;
  passcode?: string;
  class?: string;
  grade?: string;
  schoolId?: string;
  schoolName?: string;
  schoolCode?: string;
  plan?: string;
  subjects?: string[];
  schedule?: string;
  status?: string;
  notes?: string;
}

interface ProgramModule {
  id: string;
  title: string;
  stageName: string;
  stageNumber: number;
  trackName: string;
  completed: boolean;
  completionDate?: string;
  score?: string;
  competencies: string[];
  instructor: string;
}

interface ResourceItem {
  id: string;
  title: string;
  url?: string;
  type?: string;
  description?: string;
  subject?: string;
  targetClass?: string;
  class?: string;
  isClassSpecific?: boolean;
  createdAt?: any;
}

interface LinkItem {
  id: string;
  title: string;
  url: string;
  platform?: string;
  description?: string;
  meetingTime?: string;
}

interface ExamItem {
  id: string;
  title: string;
  link?: string;
  url?: string;
  subject?: string;
  dueDate?: string;
  duration?: string;
  targetClass?: string;
  class?: string;
  passcodeProtected?: boolean;
  passcode?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  createdAt?: any;
  readBy?: string[];
}

// Circular Progress Component matching Screenshot
const CircularProgress: React.FC<{ percentage: number; label: string; size?: number; strokeWidth?: number }> = ({
  percentage,
  label,
  size = 112,
  strokeWidth = 9
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-3 text-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-slate-200 dark:text-slate-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e63946"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{percentage}%</span>
        </div>
      </div>
      <p className="mt-2.5 text-xs font-bold text-gray-700 dark:text-slate-300 line-clamp-1">{label}</p>
    </div>
  );
};

const StudentDashboard: React.FC = () => {
  const { toast } = useToast();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [personalResources, setPersonalResources] = useState<ResourceItem[]>([]);
  const [personalLinks, setPersonalLinks] = useState<LinkItem[]>([]);
  const [generalResources, setGeneralResources] = useState<ResourceItem[]>([]);
  const [classResources, setClassResources] = useState<ResourceItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [modules, setModules] = useState<ProgramModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState<'ALL' | 'CLASS' | 'GENERAL'>('ALL');

  // Certificate Modal State
  const [selectedModuleForCert, setSelectedModuleForCert] = useState<ProgramModule | null>(null);
  const [certStudentName, setCertStudentName] = useState('');
  const [generatingCert, setGeneratingCert] = useState(false);

  useEffect(() => {
    const fetchStudentData = async () => {
      setLoading(true);
      try {
        const currentUser = auth.currentUser;
        const studentDocId = sessionStorage.getItem('studentDocId');
        const studentUsername = sessionStorage.getItem('studentUsername');
        const cachedClass = sessionStorage.getItem('studentClass');

        let sData: StudentInfo | null = null;
        let sId = studentDocId || '';

        // 1. Fetch Student Profile
        if (sId) {
          try {
            const sSnap = await getDoc(doc(db, 'individualStudents', sId));
            if (sSnap.exists()) {
              sData = { id: sSnap.id, ...sSnap.data() };
            }
          } catch (e) {
            console.warn('Direct sId fetch error:', e);
          }
        }

        if (!sData && currentUser) {
          try {
            const q = query(
              collection(db, 'individualStudents'),
              where('firebaseUid', '==', currentUser.uid)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
              sId = snap.docs[0].id;
              sData = { id: snap.docs[0].id, ...snap.docs[0].data() };
            }
          } catch (e) {
            console.warn('Uid lookup error:', e);
          }
        }

        if (!sData && studentUsername) {
          try {
            const q = query(
              collection(db, 'individualStudents'),
              where('username', '==', studentUsername.toLowerCase())
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
              sId = snap.docs[0].id;
              sData = { id: snap.docs[0].id, ...snap.docs[0].data() };
            }
          } catch (e) {
            console.warn('Username lookup error:', e);
          }
        }

        // No fabricated profile: a protected dashboard must only display authoritative records.
        if (!sData) {
          setStudent(null);
          setPersonalResources([]);
          setPersonalLinks([]);
          setGeneralResources([]);
          setClassResources([]);
          setExams([]);
          setNotifications([]);
          setModules([]);
          return;
        }
        if (!sData.class && cachedClass) {
          sData.class = cachedClass;
        }
        setStudent(sData);
        setCertStudentName(sData.fullName || 'Active Cadet');

        const assignedClass = (sData.class || sData.grade || cachedClass || '').trim();

        // 2. Fetch Personal Resources
        if (sId || currentUser?.uid) {
          try {
            const resourceQueries = [
              query(collection(db, 'personalResources'), where('studentId', '==', sId)),
              ...(currentUser?.uid ? [query(collection(db, 'personalResources'), where('userId', '==', currentUser.uid))] : [])
            ];
            const pResMap = new Map<string, ResourceItem>();
            for (const rq of resourceQueries) {
              const snap = await getDocs(rq);
              snap.forEach(d => pResMap.set(d.id, { id: d.id, ...d.data() } as ResourceItem));
            }
            setPersonalResources(Array.from(pResMap.values()));
          } catch (e) {
            console.warn('Personal resources query error:', e);
          }

          // 3. Fetch Personal Links
          try {
            const linkQueries = [
              query(collection(db, 'personalLinks'), where('studentId', '==', sId)),
              ...(currentUser?.uid ? [query(collection(db, 'personalLinks'), where('userId', '==', currentUser.uid))] : [])
            ];
            const pLinksMap = new Map<string, LinkItem>();
            for (const lq of linkQueries) {
              const snap = await getDocs(lq);
              snap.forEach(d => pLinksMap.set(d.id, { id: d.id, ...d.data() } as LinkItem));
            }
            setPersonalLinks(Array.from(pLinksMap.values()));
          } catch (e) {
            console.warn('Personal links query error:', e);
          }
        }

        // 4. Fetch General Resources & Class Specific Resources
        try {
          const genList: ResourceItem[] = [];
          const clsList: ResourceItem[] = [];

          // From standard resources collection
          const resSnap = await getDocs(query(collection(db, 'resources'), limit(15)));
          resSnap.docs.forEach(d => {
            const item = { id: d.id, ...d.data() } as ResourceItem;
            const itemClass = (item.targetClass || item.class || '').trim();
            if (itemClass && assignedClass && (itemClass.toLowerCase() === assignedClass.toLowerCase() || itemClass.toLowerCase().includes(assignedClass.toLowerCase()))) {
              clsList.push({ ...item, isClassSpecific: true });
            } else {
              genList.push({ ...item, isClassSpecific: false });
            }
          });

          // From schoolResources collection
          try {
            const schResSnap = sData?.schoolId
              ? await getDocs(query(collection(db, 'schoolResources'), where('schoolId', '==', sData.schoolId)))
              : { docs: [] } as any;
            schResSnap.docs.forEach((d: any) => {
              const item = { id: d.id, ...d.data() } as ResourceItem;
              const itemClass = (item.targetClass || item.class || '').trim();
              if (itemClass && assignedClass && (itemClass.toLowerCase() === assignedClass.toLowerCase() || itemClass.toLowerCase().includes(assignedClass.toLowerCase()))) {
                if (!clsList.some(r => r.id === item.id)) {
                  clsList.push({ ...item, isClassSpecific: true });
                }
              } else {
                if (!genList.some(r => r.id === item.id)) {
                  genList.push({ ...item, isClassSpecific: false });
                }
              }
            });
          } catch {
            // Non-fatal
          }

          setGeneralResources(genList);
          setClassResources(clsList);
        } catch (e) {
          console.warn('Resources fetch error:', e);
        }

        // 5. Fetch Exams & Mock Tests (General + Forwarded Class Exams)
        try {
          const examList: ExamItem[] = [];
          
          const exSnap = await getDocs(query(collection(db, 'exams'), limit(10)));
          exSnap.docs.forEach(d => {
            examList.push({ id: d.id, ...d.data() } as ExamItem);
          });

          try {
            const schExSnap = sData?.schoolId
              ? await getDocs(query(collection(db, 'schoolExams'), where('schoolId', '==', sData.schoolId)))
              : { docs: [] } as any;
            schExSnap.docs.forEach((d: any) => {
              const exData = { id: d.id, ...d.data() } as ExamItem;
              const exClass = (exData.targetClass || exData.class || '').trim();
              if (!exClass || !assignedClass || exClass.toLowerCase().includes(assignedClass.toLowerCase()) || assignedClass.toLowerCase().includes(exClass.toLowerCase())) {
                if (!examList.some(x => x.id === exData.id)) {
                  examList.push(exData);
                }
              }
            });
          } catch {
            // Non-fatal
          }

          setExams(examList);
        } catch (e) {
          console.warn('Exams fetch error:', e);
        }

        // 6. Fetch Announcements / Notifications
        try {
          const notificationQueries = [
            query(collection(db, 'notifications'), where('recipientId', '==', currentUser?.uid || '')), 
            query(collection(db, 'notifications'), where('recipientId', '==', sId)),
            query(collection(db, 'notifications'), where('recipientId', '==', 'all')),
            query(collection(db, 'notifications'), where('recipientId', '==', 'all_students'))
          ];
          const notificationSnapshots = await Promise.all(notificationQueries.map(getDocs));
          const notificationMap = new Map<string, NotificationItem>();
          notificationSnapshots.forEach(snap => snap.forEach(d => notificationMap.set(d.id, { id: d.id, ...d.data() } as NotificationItem)));
          setNotifications(Array.from(notificationMap.values()).slice(0, 10));
        } catch (e) {
          console.warn('Notifications fetch error:', e);
        }

        // 7. Fetch Student Enrolled Modules
        try {
          const moduleQueries = [
            query(collection(db, 'studentModules'), where('studentId', '==', sId)),
            ...(currentUser?.uid ? [query(collection(db, 'studentModules'), where('studentId', '==', currentUser.uid))] : [])
          ];
          const moduleMap = new Map<string, any>();
          for (const mq of moduleQueries) {
            try {
              const snap = await getDocs(mq);
              snap.forEach(d => moduleMap.set(d.id, d));
            } catch {}
          }
          const mSnap = { docs: Array.from(moduleMap.values()) };
          if (mSnap.docs.length > 0) {
            const userModules: ProgramModule[] = [];
            mSnap.docs.forEach(docSnap => {
              const d = docSnap.data();
              if (!d.studentId || d.studentId === sId || d.studentId === currentUser?.uid || d.studentUsername === studentUsername) {
                userModules.push({
                  id: docSnap.id,
                  title: d.title || 'Course Module',
                  stageName: d.stageName || 'Stage 1: Discover',
                  stageNumber: Number(d.stageNumber) || 1,
                  trackName: d.trackName || 'School of Technology & Programming',
                  completed: Boolean(d.completed),
                  completionDate: d.completionDate || '',
                  score: d.score || (d.completed ? '100% Mastery' : 'In Progress'),
                  competencies: d.competencies || ['Computational Thinking', 'Project Architecture'],
                  instructor: d.instructor || 'Jaystarbliss Instructor'
                });
              }
            });
            setModules(userModules);
          } else {
            setModules([]);
          }
        } catch (e) {
          console.warn('Student modules fetch error:', e);
          setModules([]);
        }

      } catch (err) {
        console.error('Error fetching student dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, []);

  const markNotificationRead = async (notifId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const nDoc = doc(db, 'notifications', notifId);
      const snap = await getDoc(nDoc);
      if (snap.exists()) {
        const readBy = snap.data().readBy || [];
        if (!readBy.includes(uid)) {
          await updateDoc(nDoc, { readBy: [...readBy, uid] });
          setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, readBy: [...(n.readBy || []), uid] } : n));
        }
      }
    } catch (e) {
      console.warn('Could not update notification state:', e);
    }
  };

  const handleDownloadCertificate = (mod: ProgramModule, customName?: string) => {
    setGeneratingCert(true);
    try {
      const certData: ModuleCertificateData = {
        studentName: (customName || certStudentName || student?.fullName || 'Scholar').trim(),
        studentId: student?.username || student?.accessCode || 'JDH-STD',
        moduleTitle: mod.title,
        moduleStage: mod.stageName,
        programTrack: mod.trackName,
        competencies: mod.competencies,
        issueDate: mod.completionDate || new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        instructorName: mod.instructor || 'Lead Technical Instructor'
      };

      generateModuleCertificatePdf(certData);
      toast.success(`Official PDF Certificate for "${mod.title}" generated and downloaded successfully!`);
      setSelectedModuleForCert(null);
    } catch (err) {
      console.error('Error generating certificate:', err);
      toast.error('Failed to generate certificate PDF. Please try again.');
    } finally {
      setGeneratingCert(false);
    }
  };

  const courseProgressList = useMemo(() => {
    const byTrack = new Map<string, { total: number; completed: number }>();
    modules.forEach(mod => {
      const current = byTrack.get(mod.trackName) || { total: 0, completed: 0 };
      current.total += 1;
      if (mod.completed) current.completed += 1;
      byTrack.set(mod.trackName, current);
    });
    return Array.from(byTrack.entries()).map(([label, value]) => ({
      label,
      percentage: value.total ? Math.round((value.completed / value.total) * 100) : 0
    }));
  }, [modules]);

  const upcomingAssignments = useMemo(() => exams.slice(0, 3).map(e => ({
    id: e.id,
    title: e.title,
    track: e.subject || 'Assessment',
    deadline: e.dueDate || 'No deadline set',
    link: e.link || e.url
  })), [exams]);

  const recentActivities = useMemo(() => {
    return modules
      .filter(mod => mod.completed)
      .sort((a, b) => String(b.completionDate || '').localeCompare(String(a.completionDate || '')))
      .slice(0, 5)
      .map(mod => ({
        id: mod.id,
        action: 'Completed Module',
        detail: mod.title,
        time: mod.completionDate || 'Completed',
        icon: Award,
        color: 'text-emerald-500 bg-emerald-500/10'
      }));
  }, [modules]);

  const completedModulesCount = modules.filter(m => m.completed).length;

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Synchronizing student portal profile & resources...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-interface space-y-6 md:space-y-8">
      <SEO 
        title="Student Workspace Dashboard" 
        description="Access student classes, mentor feedback, assignments, module certificates, and learning resources." 
        noindex={true}
      />

      {/* Dynamic Timezone Greeting Banner */}
      <DashboardGreeting 
        name={`Cadet ${student?.fullName || 'Active Cadet'}`}
        role="STEM Cadet"
        subtitle="Track your enrolled courses, live classroom links, verified module certificates, and assessments."
      />

      {/* Top Grid: Course Progress Rings (Left/Top) & Upcoming Assignments (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Course Progress Rings Panel (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Course Progress</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Current syllabus progression across active enrolled tracks</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-500/20">
              Current Enrollment
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            {courseProgressList.map((cp, idx) => (
              <CircularProgress 
                key={idx} 
                percentage={cp.percentage} 
                label={cp.label}
              />
            ))}
          </div>
        </div>

        {/* Upcoming Assignments Panel (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Upcoming Assignments</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Milestone deliverables & assessment tests</p>
            </div>
            <span className="text-xs text-red-600 dark:text-red-400 font-bold">{upcomingAssignments.length} Pending</span>
          </div>

          <div className="space-y-3">
            {upcomingAssignments.map((task) => (
              <div 
                key={task.id} 
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 hover:border-red-500/30 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200/60 dark:border-red-500/20 group-hover:scale-105 transition-transform">
                    <Code2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{task.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{task.track}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                  {task.deadline}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Comprehensive Recharts Data Visualizer Component */}
      <StudentAnalyticsVisualizer 
        studentName={student?.fullName || 'Student'}
        studentClass={student?.class || student?.grade || 'Not recorded'}
        enrolledSubjects={student?.subjects || []}
        completedModulesCount={completedModulesCount}
        totalModulesCount={modules.length}
      />

      {/* Middle Grid: Recent Activity & Milestone Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Activity Panel (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Activity</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Chronological learning event logs</p>
            </div>
            <Activity size={16} className="text-red-500" />
          </div>

          <div className="space-y-3">
            {recentActivities.map((act) => {
              const Icon = act.icon;
              return (
                <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                  <div className={`p-2 rounded-lg ${act.color} shrink-0 mt-0.5`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{act.action}</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{act.detail}</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">{act.time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Milestone Goals & Focus Track (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center">
                <Trophy size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Milestone Focus</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">Target requirements for the current academic stage</p>
              </div>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
              Stage {modules.find(m => !m.completed)?.stageNumber || 1} in progress
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-auto">
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-950/40 border border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-gray-800 dark:text-gray-200">Next Deliverable</span>
                <span className="text-red-600 dark:text-red-400 font-bold">2 Days</span>
              </div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{upcomingAssignments[0]?.title || 'No upcoming deliverable recorded'}</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">{upcomingAssignments[0]?.deadline || 'Awaiting an assigned assessment'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-950/40 border border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-gray-800 dark:text-gray-200">Certificate Readiness</span>
                <span className="text-emerald-600 font-bold font-mono">{modules.length ? Math.round((completedModulesCount / modules.length) * 100) : 0}%</span>
              </div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{completedModulesCount} of {modules.length} Milestones Verified</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">PDF auto-issuance enabled upon completion</p>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
            <span>Primary Track: <strong className="text-gray-800 dark:text-gray-200">{student?.plan || 'STEM & Coding Academy'}</strong></span>
            <span>Study Cadence: <strong className="text-gray-800 dark:text-gray-200">Active</strong></span>
          </div>
        </div>

      </div>

      {/* Program Modules & PDF Certificate Generation Hub */}
      <div className="bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0 border border-red-200/60 dark:border-red-500/20">
              <Award size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Program Modules & Certificates</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[11px] font-bold">
                  PDF Generation Ready
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Generate and download your accredited PDF Certificates of Module Completion upon completing program milestones.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {completedModulesCount} of {modules.length} Completed
            </span>
          </div>
        </div>

        {/* Modules Grid */}
        {modules.length === 0 ? (
          <div className="p-8 text-center bg-gray-50/50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
            <Award className="mx-auto text-gray-400 mb-2" size={32} />
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">No program milestones assigned yet</p>
            <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
              Your instructor will record your course stage completions and milestone scores here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((mod) => (
              <div 
                key={mod.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  mod.completed
                    ? 'bg-gradient-to-b from-white to-red-50/20 dark:from-[#121622] dark:to-red-950/20 border-red-200/60 dark:border-red-900/30 hover:border-red-400/80 shadow-xs'
                    : 'bg-gray-50/50 dark:bg-slate-950/40 border-gray-200/70 dark:border-white/5 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-900 dark:bg-slate-800 text-white">
                      {mod.stageName}
                    </span>
                    {mod.completed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2 py-0.5 rounded-md border border-green-200/60 dark:border-green-900/50">
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                        <Clock size={12} /> {mod.score}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug mb-1">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-3">
                    {mod.trackName}
                  </p>

                  {/* Competencies Mastered Tags */}
                  <div className="mb-4">
                    <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Mastered Skills:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mod.competencies.map((comp, idx) => (
                        <span 
                          key={idx} 
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300"
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>

                  {mod.completionDate && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-4 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
                      <span>Verified: {mod.completionDate}</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">{mod.score}</span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                {mod.completed ? (
                  <div className="flex gap-2 pt-3">
                    <button
                      onClick={() => {
                        setSelectedModuleForCert(mod);
                        setCertStudentName(student?.fullName || 'Active Student');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                    >
                      <Award size={14} className="text-amber-400" />
                      <span>Customize & Preview</span>
                    </button>
                    <button
                      onClick={() => handleDownloadCertificate(mod)}
                      disabled={generatingCert}
                      title="Quick Download PDF"
                      className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                    >
                      <Download size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="pt-3">
                    <button
                      disabled
                      className="w-full py-2.5 bg-gray-100 dark:bg-slate-800/60 text-gray-400 dark:text-gray-500 rounded-xl text-xs font-bold cursor-not-allowed text-center"
                    >
                      In Progress • Complete Milestone to Unlock
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student Achievement & Mastery Badges Section */}
      <AchievementBadgeGrid 
        studentName={student?.fullName}
        title="My Achievement & Mastery Badges"
        subtitle="Earn verifiable badges and XP as you complete 5-stage milestones and projects."
      />

      {/* Main Content Sections: Live Classroom, Handouts & Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Live Links & Resources */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Personal Class & Live Stream Links */}
          <div className="bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <Video size={18} />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Live Classroom & Sessions</h2>
              </div>
              <span className="text-xs text-gray-500">Assigned by Mentor</span>
            </div>

            {personalLinks.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 dark:bg-slate-950 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                <Video size={32} className="mx-auto text-gray-400 mb-2 opacity-50" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No scheduled personal live links at this moment.</p>
                <p className="text-xs text-gray-500 mt-1">Your tutor will post Zoom, Google Meet, or scratch room links here prior to class.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {personalLinks.map((link) => (
                  <div key={link.id} className="p-4 rounded-xl border border-gray-200/80 dark:border-white/5 bg-gray-50/50 dark:bg-slate-950/50 hover:border-red-500/40 transition-colors flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 uppercase">
                          {link.platform || 'Class Link'}
                        </span>
                        {link.meetingTime && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} /> {link.meetingTime}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{link.title}</h3>
                      {link.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{link.description}</p>
                      )}
                    </div>
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center justify-center gap-2 w-full px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                    >
                      Join Class Room <ExternalLink size={13} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personal & General Resources */}
          <div className="bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Learning Materials & Handouts</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Curated resources, handouts, and class-specific coursework</p>
                </div>
              </div>
              <Link 
                to="/portal/student/resources" 
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
              >
                <span>Browse Full Resource Library</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-white/5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setResourceFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  resourceFilter === 'ALL'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                All Resources ({personalResources.length + classResources.length + generalResources.length})
              </button>
              {student?.class && (
                <button
                  type="button"
                  onClick={() => setResourceFilter('CLASS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    resourceFilter === 'CLASS'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 hover:bg-red-100'
                  }`}
                >
                  Class Materials: {student.class} ({classResources.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setResourceFilter('GENERAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  resourceFilter === 'GENERAL'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                General Library ({generalResources.length})
              </button>
            </div>

            {(() => {
              let displayList: ResourceItem[] = [];
              if (resourceFilter === 'ALL') {
                displayList = [...personalResources, ...classResources, ...generalResources];
              } else if (resourceFilter === 'CLASS') {
                displayList = classResources;
              } else {
                displayList = generalResources;
              }

              if (displayList.length === 0) {
                return (
                  <div className="p-8 text-center bg-gray-50 dark:bg-slate-950 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                    <FileText size={32} className="mx-auto text-gray-400 mb-2 opacity-50" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {resourceFilter === 'CLASS' 
                        ? `No specific resources uploaded yet for ${student?.class || 'your class'}.`
                        : 'Learning materials are being uploaded by instructors.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {displayList.map((res) => (
                    <div key={res.id} className="p-4 rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-slate-950 hover:shadow-xs transition-shadow flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 shrink-0 mt-0.5">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {res.isClassSpecific && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-500/20">
                                Class: {res.targetClass || res.class || student?.class}
                              </span>
                            )}
                            {res.type && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                                {res.type}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{res.title}</h3>
                          {res.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{res.description}</p>
                          )}
                        </div>
                      </div>
                      {res.url && (
                        <a 
                          href={res.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-slate-800 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                        >
                          <Download size={13} /> Access
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Active Assessments & Quizzes */}
          <div className="bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600 flex items-center justify-center">
                  <Trophy size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Assessments & Quizzes</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Class exams and evaluation tests forwarded from administrator</p>
                </div>
              </div>
            </div>

            {exams.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 dark:bg-slate-950 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                <p className="text-xs text-gray-500">No active examinations pending submission for your class.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {exams.map(exam => (
                  <div key={exam.id} className="p-4 rounded-xl border border-gray-200/80 dark:border-white/5 bg-gray-50 dark:bg-slate-950 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                          {exam.subject || 'CBT Assessment'}
                        </span>
                        {exam.targetClass && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400">
                            {exam.targetClass}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm mt-1">{exam.title}</h3>
                      {exam.duration && <p className="text-xs text-gray-500 mt-1">Duration: {exam.duration}</p>}
                      {exam.passcodeProtected && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-mono mt-1 flex items-center gap-1">
                          <Lock size={12} /> Requires Exam Passcode
                        </p>
                      )}
                    </div>
                    {(exam.link || exam.url) && (
                      <a 
                        href={exam.link || exam.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-red-600 dark:hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Start Test <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar: Profile card & Announcements */}
        <div className="space-y-6">

          {/* Student Identity Card */}
          <div className="bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Cadet Profile</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/5">
                <span className="text-gray-500 dark:text-gray-400">Username:</span>
                <span className="font-bold text-gray-900 dark:text-white font-mono">{student?.username || '—'}</span>
              </div>
              {student?.class && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/5">
                  <span className="text-gray-500 dark:text-gray-400">Assigned Class:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{student.class}</span>
                </div>
              )}
              {student?.schoolName && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/5">
                  <span className="text-gray-500 dark:text-gray-400">School Partner:</span>
                  <span className="font-bold text-gray-900 dark:text-white text-right truncate max-w-[150px]">{student.schoolName}</span>
                </div>
              )}
              {(student?.accessCode || student?.passcode) && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5">
                  <span className="text-gray-500 dark:text-gray-400">Access Passcode:</span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/40">
                    {student.accessCode || student.passcode}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/5">
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <span className="font-bold text-green-600 dark:text-green-400">Active Learner</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/5">
                <span className="text-gray-500 dark:text-gray-400">Primary Track:</span>
                <span className="font-bold text-gray-900 dark:text-white text-right">{student?.plan || 'Dynamic Coding'}</span>
              </div>
              {student?.notes && (
                <div className="py-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Mentor Remarks:</span>
                  <p className="text-xs bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg text-amber-800 dark:text-amber-200 border border-amber-200/50 dark:border-amber-800/50">
                    {student.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Institute Announcements */}
          <div className="bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={18} className="text-red-600 dark:text-red-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Announcements</h2>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-gray-500">No new announcements today.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map(n => {
                  const isRead = auth.currentUser?.uid && n.readBy?.includes(auth.currentUser.uid);
                  return (
                    <div 
                      key={n.id} 
                      onClick={() => markNotificationRead(n.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                        isRead 
                          ? 'border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-slate-950/50 text-gray-500' 
                          : 'border-red-500/30 bg-red-500/5 dark:bg-red-500/10 text-gray-900 dark:text-white'
                      }`}
                    >
                      <div className="font-bold mb-1 flex items-center justify-between">
                        <span>{n.title}</span>
                        {!isRead && <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400"></span>}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 line-clamp-3">{n.message}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Certificate Customization & Download Modal */}
      {selectedModuleForCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121622] border border-gray-200 dark:border-white/10 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
                  <Award size={26} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">
                    Generate Module Certificate
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Accredited verification by Jaystarbliss Studios
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedModuleForCert(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Certificate Preview Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-white/5 mb-6 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-red-600 uppercase">{selectedModuleForCert.stageName}</span>
                <span className="text-gray-500 font-mono">Credential ID: JDS-CERT-{Math.floor(1000 + Math.random() * 9000)}</span>
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">
                  {selectedModuleForCert.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Track: {selectedModuleForCert.trackName}
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200/60 dark:border-white/5 flex items-center justify-between text-xs text-gray-500">
                <span>Instructor: {selectedModuleForCert.instructor}</span>
                <span className="font-bold text-green-600 dark:text-green-400">{selectedModuleForCert.score}</span>
              </div>
            </div>

            {/* Student Name Confirmation */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Student Name (Appears on Certificate)
                </label>
                <input
                  type="text"
                  value={certStudentName}
                  onChange={(e) => setCertStudentName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Ensure the name is spelled accurately as it will be engraved onto the official document.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedModuleForCert(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generatingCert || !certStudentName.trim()}
                onClick={() => handleDownloadCertificate(selectedModuleForCert, certStudentName)}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-red-600/20"
              >
                {generatingCert ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Download Official Certificate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Achievement & Mastery Badges Section */}
      <AchievementBadgeGrid 
        studentName={student?.fullName}
        title="My Achievement & Mastery Badges"
        subtitle="Earn verifiable badges and XP as you complete 5-stage milestones and projects."
      />

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Live Links & Resources */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Personal Class & Live Stream Links */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center">
                  <Video size={18} />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Live Classroom & Sessions</h2>
              </div>
              <span className="text-xs text-gray-500">Assigned by Mentor</span>
            </div>

            {personalLinks.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 dark:bg-slate-950 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                <Video size={32} className="mx-auto text-gray-400 mb-2 opacity-50" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No scheduled personal live links at this moment.</p>
                <p className="text-xs text-gray-500 mt-1">Your tutor will post Zoom, Google Meet, or scratch room links here prior to class.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {personalLinks.map((link) => (
                  <div key={link.id} className="p-4 rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 hover:border-brand-red/40 transition-colors flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-red/10 text-brand-red uppercase">
                          {link.platform || 'Class Link'}
                        </span>
                        {link.meetingTime && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} /> {link.meetingTime}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{link.title}</h3>
                      {link.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{link.description}</p>
                      )}
                    </div>
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center justify-center gap-2 w-full px-3 py-2 bg-brand-red text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                    >
                      Join Class Room <ExternalLink size={13} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personal & General Resources */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Learning Materials & Handouts</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Curated resources, handouts, and class-specific coursework</p>
                </div>
              </div>
              <Link 
                to="/portal/student/resources" 
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:text-red-700 dark:hover:text-red-400 transition-colors"
              >
                <span>Browse Full Resource Library</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-slate-800 overflow-x-auto">
              <button
                type="button"
                onClick={() => setResourceFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  resourceFilter === 'ALL'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                All Resources ({personalResources.length + classResources.length + generalResources.length})
              </button>
              {student?.class && (
                <button
                  type="button"
                  onClick={() => setResourceFilter('CLASS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    resourceFilter === 'CLASS'
                      ? 'bg-brand-red text-white'
                      : 'bg-red-50 dark:bg-red-950/30 text-brand-red border border-red-200 dark:border-red-900/30 hover:bg-red-100'
                  }`}
                >
                  Class Materials: {student.class} ({classResources.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setResourceFilter('GENERAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  resourceFilter === 'GENERAL'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                General Library ({generalResources.length})
              </button>
            </div>

            {(() => {
              let displayList: ResourceItem[] = [];
              if (resourceFilter === 'ALL') {
                displayList = [...personalResources, ...classResources, ...generalResources];
              } else if (resourceFilter === 'CLASS') {
                displayList = classResources;
              } else {
                displayList = generalResources;
              }

              if (displayList.length === 0) {
                return (
                  <div className="p-8 text-center bg-gray-50 dark:bg-slate-950 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                    <FileText size={32} className="mx-auto text-gray-400 mb-2 opacity-50" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {resourceFilter === 'CLASS' 
                        ? `No specific resources uploaded yet for ${student?.class || 'your class'}.`
                        : 'Learning materials are being uploaded by instructors.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {displayList.map((res) => (
                    <div key={res.id} className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 hover:shadow-xs transition-shadow flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-brand-red/10 text-brand-red shrink-0 mt-0.5">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {res.isClassSpecific && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand-red/10 text-brand-red border border-brand-red/20">
                                Class: {res.targetClass || res.class || student?.class}
                              </span>
                            )}
                            {res.type && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                                {res.type}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{res.title}</h3>
                          {res.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{res.description}</p>
                          )}
                        </div>
                      </div>
                      {res.url && (
                        <a 
                          href={res.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-slate-800 hover:bg-brand-red hover:text-white dark:hover:bg-brand-red text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                        >
                          <Download size={13} /> Access
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Active Assessments & Quizzes */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600 flex items-center justify-center">
                  <Trophy size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Assessments & Quizzes</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Class exams and evaluation tests forwarded from administrator</p>
                </div>
              </div>
            </div>

            {exams.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 dark:bg-slate-950 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                <p className="text-xs text-gray-500">No active examinations pending submission for your class.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {exams.map(exam => (
                  <div key={exam.id} className="p-4 rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                          {exam.subject || 'CBT Assessment'}
                        </span>
                        {exam.targetClass && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-red/10 text-brand-red">
                            {exam.targetClass}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm mt-1">{exam.title}</h3>
                      {exam.duration && <p className="text-xs text-gray-500 mt-1">Duration: {exam.duration}</p>}
                      {exam.passcodeProtected && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-mono mt-1 flex items-center gap-1">
                          <Lock size={12} /> Requires Exam Passcode
                        </p>
                      )}
                    </div>
                    {(exam.link || exam.url) && (
                      <a 
                        href={exam.link || exam.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-brand-red dark:hover:bg-brand-red text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Start Test <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar: Profile card & Announcements */}
        <div className="space-y-8">

          {/* Student Identity Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Cadet Profile</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-gray-400">Username:</span>
                <span className="font-bold text-gray-900 dark:text-white font-mono">{student?.username || '—'}</span>
              </div>
              {student?.class && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-gray-500 dark:text-gray-400">Assigned Class:</span>
                  <span className="font-bold text-brand-red">{student.class}</span>
                </div>
              )}
              {student?.schoolName && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-gray-500 dark:text-gray-400">School Partner:</span>
                  <span className="font-bold text-gray-900 dark:text-white text-right truncate max-w-[150px]">{student.schoolName}</span>
                </div>
              )}
              {(student?.accessCode || student?.passcode) && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-gray-500 dark:text-gray-400">Access Passcode:</span>
                  <span className="font-mono font-bold text-brand-red bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/40">
                    {student.accessCode || student.passcode}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <span className="font-bold text-green-600 dark:text-green-400">Active Learner</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-gray-400">Primary Track:</span>
                <span className="font-bold text-gray-900 dark:text-white text-right">{student?.plan || 'Dynamic Coding'}</span>
              </div>
              {student?.notes && (
                <div className="py-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Mentor Remarks:</span>
                  <p className="text-xs bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg text-amber-800 dark:text-amber-200 border border-amber-200/50 dark:border-amber-800/50">
                    {student.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Institute Announcements */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={18} className="text-brand-red" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Announcements</h2>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-gray-500">No new announcements today.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map(n => {
                  const isRead = auth.currentUser?.uid && n.readBy?.includes(auth.currentUser.uid);
                  return (
                    <div 
                      key={n.id} 
                      onClick={() => markNotificationRead(n.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                        isRead 
                          ? 'border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 text-gray-500' 
                          : 'border-brand-red/30 bg-brand-red/5 dark:bg-brand-red/10 text-gray-900 dark:text-white'
                      }`}
                    >
                      <div className="font-bold mb-1 flex items-center justify-between">
                        <span>{n.title}</span>
                        {!isRead && <span className="w-2 h-2 rounded-full bg-brand-red"></span>}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 line-clamp-3">{n.message}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default StudentDashboard;
