import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Award,
  Bell,
  CheckCircle2,
  Clock,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Trophy,
  Video,
  X,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import SEO from '../../components/ui/SEO';
import { AchievementBadgeGrid } from '../../components/ecosystem/AchievementBadge';
import { DashboardGreeting } from '../../components/portal/DashboardGreeting';
import { StudentAnalyticsVisualizer } from '../../components/portal/StudentAnalyticsVisualizer';
import { ResourceListView } from '../../components/portal/ResourceListView';
import { useToast } from '../../contexts/ToastContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { getEffectiveAuth } from '../../utils/impersonation';
import {
  generateModuleCertificatePdf,
  type ModuleCertificateData,
} from '../../lib/certificatePdfGenerator';

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
  school?: string;
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
  fileUrl?: string;
  type?: string;
  docType?: string;
  description?: string;
  subject?: string;
  targetClass?: string;
  class?: string;
  classLevel?: string;
  assignedClasses?: string[];
  schoolId?: string;
  schoolName?: string;
  school?: string;
  isClassSpecific?: boolean;
  dateAdded?: string;
  createdAt?: string;
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
}

const stableCredentialId = (studentKey: string, moduleId: string) => {
  let hash = 0;
  const source = `${studentKey}:${moduleId}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `JDS-CERT-${hash.toString(36).toUpperCase().padStart(7, '0').slice(-7)}`;
};

const formatDate = (value?: string) => {
  if (!value) return 'No deadline set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const CircularProgress: React.FC<{
  percentage: number;
  label: string;
  modulesDone: number;
  modulesTotal: number;
}> = ({ percentage, label, modulesDone, modulesTotal }) => {
  const size = 112;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (safePercentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-950/60 px-2 py-4 text-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          className="-rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${label}: ${safePercentage}% complete`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-slate-200 dark:text-slate-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-brand-red transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
            {safePercentage}%
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-gray-800 dark:text-slate-200 line-clamp-2">
        {label || 'Learning track'}
      </p>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
        {modulesDone} of {modulesTotal} modules
      </p>
    </div>
  );
};

const StudentDashboard: React.FC = () => {
  const { toast } = useToast();
  const { notifications, unreadCount, openDrawer, isNotificationRead } = useNotifications();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [personalResources, setPersonalResources] = useState<ResourceItem[]>([]);
  const [personalLinks, setPersonalLinks] = useState<LinkItem[]>([]);
  const [generalResources, setGeneralResources] = useState<ResourceItem[]>([]);
  const [classResources, setClassResources] = useState<ResourceItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [modules, setModules] = useState<ProgramModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState<'ALL' | 'CLASS' | 'GENERAL'>('ALL');
  const [selectedModuleForCert, setSelectedModuleForCert] = useState<ProgramModule | null>(null);
  const [certStudentName, setCertStudentName] = useState('');
  const [generatingCert, setGeneratingCert] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchStudentData = async () => {
      setLoading(true);
      try {
        const effective = getEffectiveAuth();
        const currentUser = auth.currentUser;
        const studentDocId = effective.effectiveStudentDocId || sessionStorage.getItem('studentDocId');
        const studentUsername = sessionStorage.getItem('studentUsername');
        const cachedClass = effective.effectiveClass || sessionStorage.getItem('studentClass');

        let studentRecord: StudentInfo | null = null;
        let studentId = studentDocId || '';

        // 1. Direct doc ID lookup in individualStudents or students
        if (studentId) {
          try {
            const snap = await getDoc(doc(db, 'individualStudents', studentId));
            if (snap.exists()) {
              studentRecord = { id: snap.id, ...snap.data() } as StudentInfo;
            } else {
              const sSnap = await getDoc(doc(db, 'students', studentId));
              if (sSnap.exists()) {
                studentRecord = { id: sSnap.id, ...sSnap.data() } as StudentInfo;
              }
            }
          } catch (error) {
            console.warn('Direct student lookup failed:', error);
          }
        }

        // 2. Lookup by effective UID
        const lookupUid = effective.effectiveUid || currentUser?.uid;
        if (!studentRecord && lookupUid) {
          try {
            const [indivSnap, studSnap] = await Promise.all([
              getDocs(query(collection(db, 'individualStudents'), where('firebaseUid', '==', lookupUid), limit(1))).catch(() => ({ empty: true, docs: [] })),
              getDocs(query(collection(db, 'students'), where('firebaseUid', '==', lookupUid), limit(1))).catch(() => ({ empty: true, docs: [] }))
            ]);
            if (!indivSnap.empty) {
              studentId = indivSnap.docs[0].id;
              studentRecord = { id: indivSnap.docs[0].id, ...indivSnap.docs[0].data() } as StudentInfo;
            } else if (!studSnap.empty) {
              studentId = studSnap.docs[0].id;
              studentRecord = { id: studSnap.docs[0].id, ...studSnap.docs[0].data() } as StudentInfo;
            }
          } catch (error) {
            console.warn('Firebase UID lookup failed:', error);
          }
        }

        // 3. Lookup by email
        if (!studentRecord && effective.effectiveEmail) {
          try {
            const [indivSnap, studSnap] = await Promise.all([
              getDocs(query(collection(db, 'individualStudents'), where('email', '==', effective.effectiveEmail.toLowerCase()), limit(1))).catch(() => ({ empty: true, docs: [] })),
              getDocs(query(collection(db, 'students'), where('email', '==', effective.effectiveEmail.toLowerCase()), limit(1))).catch(() => ({ empty: true, docs: [] }))
            ]);
            if (!indivSnap.empty) {
              studentId = indivSnap.docs[0].id;
              studentRecord = { id: indivSnap.docs[0].id, ...indivSnap.docs[0].data() } as StudentInfo;
            } else if (!studSnap.empty) {
              studentId = studSnap.docs[0].id;
              studentRecord = { id: studSnap.docs[0].id, ...studSnap.docs[0].data() } as StudentInfo;
            }
          } catch (error) {
            console.warn('Email student lookup failed:', error);
          }
        }

        // 4. Lookup by username
        if (!studentRecord && studentUsername) {
          try {
            const [indivSnap, studSnap] = await Promise.all([
              getDocs(query(collection(db, 'individualStudents'), where('username', '==', studentUsername.toLowerCase()), limit(1))).catch(() => ({ empty: true, docs: [] })),
              getDocs(query(collection(db, 'students'), where('username', '==', studentUsername.toLowerCase()), limit(1))).catch(() => ({ empty: true, docs: [] }))
            ]);
            if (!indivSnap.empty) {
              studentId = indivSnap.docs[0].id;
              studentRecord = { id: indivSnap.docs[0].id, ...indivSnap.docs[0].data() } as StudentInfo;
            } else if (!studSnap.empty) {
              studentId = studSnap.docs[0].id;
              studentRecord = { id: studSnap.docs[0].id, ...studSnap.docs[0].data() } as StudentInfo;
            }
          } catch (error) {
            console.warn('Username lookup failed:', error);
          }
        }

        if (cancelled) return;

        if (!studentRecord) {
          if (effective.isMasquerading) {
            studentRecord = {
              id: effective.effectiveUid || 'student-masquerade',
              fullName: effective.effectiveName || 'Impersonated Student',
              email: effective.effectiveEmail,
              class: cachedClass || 'Junior Secondary',
              schoolId: effective.effectiveSchoolId
            };
          } else {
            setStudent(null);
            setPersonalResources([]);
            setPersonalLinks([]);
            setGeneralResources([]);
            setClassResources([]);
            setExams([]);
            setModules([]);
            return;
          }
        }

        if (!studentRecord.class && cachedClass) {
          studentRecord.class = cachedClass;
        }

        setStudent(studentRecord);
        setCertStudentName(studentRecord.fullName || '');
        const assignedClass = (studentRecord.class || studentRecord.grade || cachedClass || '').trim();
        const currentStudentId = studentId;
        const currentUid = currentUser?.uid;

        const [personalResourceResults, personalLinkResults, resourceSnapshot, examSnapshot] = await Promise.all([
          currentStudentId || currentUid
            ? Promise.all([
                getDocs(query(collection(db, 'personalResources'), where('studentId', '==', currentStudentId))),
                ...(currentUid
                  ? [getDocs(query(collection(db, 'personalResources'), where('userId', '==', currentUid)))]
                  : []),
              ])
            : Promise.resolve([]),
          currentStudentId || currentUid
            ? Promise.all([
                getDocs(query(collection(db, 'personalLinks'), where('studentId', '==', currentStudentId))),
                ...(currentUid
                  ? [getDocs(query(collection(db, 'personalLinks'), where('userId', '==', currentUid)))]
                  : []),
              ])
            : Promise.resolve([]),
          getDocs(query(collection(db, 'resources'), limit(20))),
          getDocs(query(collection(db, 'exams'), limit(15))),
        ]);

        if (cancelled) return;

        const personalResourceMap = new Map<string, ResourceItem>();
        personalResourceResults.forEach((snap) => {
          snap.forEach((item) => personalResourceMap.set(item.id, { id: item.id, ...item.data() } as ResourceItem));
        });
        setPersonalResources(Array.from(personalResourceMap.values()));

        const personalLinkMap = new Map<string, LinkItem>();
        personalLinkResults.forEach((snap) => {
          snap.forEach((item) => personalLinkMap.set(item.id, { id: item.id, ...item.data() } as LinkItem));
        });
        setPersonalLinks(Array.from(personalLinkMap.values()));

        const classList: ResourceItem[] = [];
        const generalList: ResourceItem[] = [];

        const isUniversalResource = (item: any) => {
          const itemClasses: string[] = Array.isArray(item.assignedClasses) 
            ? item.assignedClasses 
            : (item.targetClass ? [item.targetClass] : (item.class ? [item.class] : []));
          const cl = (item.classLevel || item.gradeLevel || '').toLowerCase().trim();
          const category = (item.category || '').toLowerCase().trim();

          if (category === 'both' || category === 'universal' || category === 'general' || category === 'all') return true;
          if (itemClasses.some(c => ['all classes', 'all', 'general', 'universal'].includes(c.toLowerCase().trim()))) return true;
          if (cl === 'all classes' || cl === 'all' || cl === 'general' || cl === 'universal' || (!cl && itemClasses.length === 0)) return true;
          return false;
        };

        const isItemForClass = (item: any) => {
          if (!assignedClass) return false;
          const target = assignedClass.toLowerCase().trim();
          const itemClasses: string[] = Array.isArray(item.assignedClasses) 
            ? item.assignedClasses 
            : (item.targetClass ? [item.targetClass] : (item.class ? [item.class] : []));
          
          if (itemClasses.length > 0) {
            return itemClasses.some(c => {
              const lc = c.toLowerCase().trim();
              return lc === target || lc.includes(target) || target.includes(lc);
            });
          }

          const cl = (item.classLevel || item.gradeLevel || '').toLowerCase().trim();
          if (cl && cl !== 'all classes' && cl !== 'all' && cl !== 'general') {
            return cl === target || cl.includes(target) || target.includes(cl);
          }

          return false;
        };

        resourceSnapshot.forEach((resourceDoc) => {
          const item = { id: resourceDoc.id, ...resourceDoc.data() } as ResourceItem;
          if (isItemForClass(item)) {
            classList.push({ ...item, isClassSpecific: true });
          } else if (isUniversalResource(item)) {
            generalList.push({ ...item, isClassSpecific: false });
          }
        });

        // Ensure school students see all their school resources and assigned lessons
        const activeSchoolId = studentRecord.schoolId || sessionStorage.getItem('schoolId') || localStorage.getItem('jaystar_school_id') || studentRecord.school;
        try {
          const schoolResourceSnap = await getDocs(
            activeSchoolId
              ? query(collection(db, 'schoolResources'), where('schoolId', '==', activeSchoolId), limit(50))
              : query(collection(db, 'schoolResources'), limit(50))
          ).catch(() => getDocs(collection(db, 'schoolResources')).catch(() => ({ docs: [] })));

          schoolResourceSnap.docs?.forEach((resourceDoc: any) => {
            const item = { id: resourceDoc.id, ...resourceDoc.data() } as ResourceItem;
            if (!activeSchoolId || !item.schoolId || item.schoolId === activeSchoolId || item.schoolName === studentRecord.schoolName || item.school === studentRecord.school) {
              const isMatch = isItemForClass(item);
              const isUniv = isUniversalResource(item);
              if (isMatch) {
                if (!classList.some((resource) => resource.id === item.id)) {
                  classList.push({ ...item, isClassSpecific: true });
                }
              } else if (isUniv) {
                if (!generalList.some((resource) => resource.id === item.id)) {
                  generalList.push({ ...item, isClassSpecific: false });
                }
              }
            }
          });
        } catch (error) {
          console.warn('School resource lookup failed:', error);
        }

        setClassResources(classList);
        setGeneralResources(generalList);

        const examList: ExamItem[] = examSnapshot.docs.map((examDoc) => ({
          id: examDoc.id,
          ...examDoc.data(),
        } as ExamItem));

        if (studentRecord.schoolId) {
          try {
            const schoolExamSnap = await getDocs(
              query(collection(db, 'schoolExams'), where('schoolId', '==', studentRecord.schoolId), limit(20))
            );
            schoolExamSnap.forEach((examDoc) => {
              const exam = { id: examDoc.id, ...examDoc.data() } as ExamItem;
              const examClass = (exam.targetClass || exam.class || '').trim().toLowerCase();
              const target = assignedClass.toLowerCase();
              if (!examClass || !target || examClass.includes(target) || target.includes(examClass)) {
                if (!examList.some((item) => item.id === exam.id)) examList.push(exam);
              }
            });
          } catch (error) {
            console.warn('School exam lookup failed:', error);
          }
        }
        setExams(examList);

        try {
          const moduleQueries = [
            query(collection(db, 'studentModules'), where('studentId', '==', currentStudentId)),
            ...(currentUid
              ? [query(collection(db, 'studentModules'), where('studentId', '==', currentUid))]
              : []),
          ];
          const moduleMap = new Map<string, ProgramModule>();
          const moduleSnapshots = await Promise.all(moduleQueries.map(getDocs));
          moduleSnapshots.forEach((snap) => {
            snap.forEach((moduleDoc) => {
              const data = moduleDoc.data();
              if (
                data.studentId === currentStudentId ||
                data.studentId === currentUid ||
                data.studentUsername === studentUsername
              ) {
                moduleMap.set(moduleDoc.id, {
                  id: moduleDoc.id,
                  title: data.title || 'Untitled module',
                  stageName: data.stageName || `Stage ${Number(data.stageNumber) || 1}`,
                  stageNumber: Number(data.stageNumber) || 1,
                  trackName: data.trackName || 'Learning Track',
                  completed: Boolean(data.completed),
                  completionDate: data.completionDate || '',
                  score: data.score || '',
                  competencies: Array.isArray(data.competencies) ? data.competencies : [],
                  instructor: data.instructor || '',
                });
              }
            });
          });
          setModules(Array.from(moduleMap.values()).sort((a, b) => a.stageNumber - b.stageNumber));
        } catch (error) {
          console.warn('Student module lookup failed:', error);
          setModules([]);
        }
      } catch (error) {
        console.error('Error loading student dashboard:', error);
        if (!cancelled) toast.error('Some student dashboard data could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStudentData();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const courseProgressList = useMemo(() => {
    const byTrack = new Map<string, { total: number; completed: number }>();
    modules.forEach((module) => {
      const key = module.trackName || 'Learning Track';
      const current = byTrack.get(key) || { total: 0, completed: 0 };
      current.total += 1;
      if (module.completed) current.completed += 1;
      byTrack.set(key, current);
    });

    return Array.from(byTrack.entries()).map(([label, value]) => ({
      label,
      percentage: value.total ? Math.round((value.completed / value.total) * 100) : 0,
      modulesDone: value.completed,
      modulesTotal: value.total,
    }));
  }, [modules]);

  const upcomingAssignments = useMemo(
    () =>
      exams
        .filter((exam) => exam.dueDate)
        .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
        .slice(0, 3),
    [exams]
  );

  const completedModules = useMemo(() => modules.filter((module) => module.completed), [modules]);
  const currentModule = useMemo(
    () => modules.find((module) => !module.completed) || modules[modules.length - 1],
    [modules]
  );
  const recentActivities = useMemo(
    () =>
      completedModules
        .slice()
        .sort((a, b) => String(b.completionDate || '').localeCompare(String(a.completionDate || '')))
        .slice(0, 5),
    [completedModules]
  );

  const displayedResources = useMemo(() => {
    if (resourceFilter === 'CLASS') return classResources;
    if (resourceFilter === 'GENERAL') return generalResources;
    return [...personalResources, ...classResources, ...generalResources];
  }, [classResources, generalResources, personalResources, resourceFilter]);

  const allStudentResources = useMemo(() => {
    const map = new Map<string, ResourceItem>();
    [...personalResources, ...classResources, ...generalResources].forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values());
  }, [personalResources, classResources, generalResources]);

  const completedModulesCount = completedModules.length;
  const overallProgress = modules.length ? Math.round((completedModulesCount / modules.length) * 100) : 0;

  const handleDownloadCertificate = (module: ProgramModule, customName?: string) => {
    if (!module.completed) return;
    const studentName = (customName || certStudentName || student?.fullName || '').trim();
    if (!studentName) {
      toast.error('Enter the student name before generating the certificate.');
      return;
    }

    setGeneratingCert(true);
    try {
      const credentialId = stableCredentialId(student?.username || student?.accessCode || student?.id || 'student', module.id);
      const certificate: ModuleCertificateData = {
        studentName,
        studentId: student?.username || student?.accessCode || student?.id || undefined,
        moduleTitle: module.title,
        moduleStage: module.stageName,
        programTrack: module.trackName,
        competencies: module.competencies,
        issueDate: module.completionDate || undefined,
        credentialId,
        instructorName: module.instructor || undefined,
      };

      generateModuleCertificatePdf(certificate);
      toast.success(`Certificate for “${module.title}” generated successfully.`);
      setSelectedModuleForCert(null);
    } catch (error) {
      console.error('Certificate generation failed:', error);
      toast.error('Failed to generate the certificate PDF.');
    } finally {
      setGeneratingCert(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[360px] flex items-center justify-center p-8">
        <div className="text-center">
          <div
            className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-brand-red dark:border-slate-800 dark:border-t-brand-red"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm font-medium text-gray-600 dark:text-slate-300">
            Loading your learning workspace…
          </p>
        </div>
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

      {!student ? (
        <section className="pro-surface rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red">
            <Lock size={26} aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Student profile not available</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500 dark:text-slate-400">
            Your portal session is active, but a student record could not be located. Please sign in again or contact an administrator.
          </p>
          <Link
            to="/portal"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-red px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-950"
          >
            Return to Portal <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <>
          <DashboardGreeting
            name={student.fullName || undefined}
            role="Technology Cadet"
            subtitle="Keep going. Your future is in progress."
          />

          {/* Hero Banner with Featured Track & Quick Continue */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 shadow-sm border border-slate-800">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-brand-red text-white">
                  Active Enrollment
                </span>
                <h2 className="text-lg sm:text-xl font-bold mt-2 tracking-tight">
                  {student.plan || 'Coding & Robotics Academy'}
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Assigned Class: <strong className="text-white">{student.class || student.grade || 'Junior Cadet'}</strong> • Current Focus: <span className="text-brand-red font-semibold">{currentModule?.title || 'Foundational Computing'}</span>
                </p>

                {/* Inline Progress Bar */}
                <div className="mt-3.5 max-w-md">
                  <div className="flex items-center justify-between text-[11px] mb-1 font-semibold text-slate-300">
                    <span>Curriculum Completion</span>
                    <span className="text-white font-bold">{overallProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-700/80 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-red rounded-full transition-all duration-500" 
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to="/portal/student/courses"
                  className="px-5 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-2"
                >
                  <span>Continue Learning</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* Compact 4-Stat Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#161B26] rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overall Progress</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{overallProgress}%</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{completedModulesCount} of {modules.length} milestones</p>
            </div>
            <div className="bg-white dark:bg-[#161B26] rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assessments</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{exams.length}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{upcomingAssignments.length} with upcoming deadlines</p>
            </div>
            <div className="bg-white dark:bg-[#161B26] rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Resources</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{personalResources.length + classResources.length + generalResources.length}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Lesson notes & materials</p>
            </div>
            <div className="bg-white dark:bg-[#161B26] rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Announcements</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{notifications.length}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Unread notifications</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 lg:col-span-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Course Progress</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Verified module completion across active learning tracks.</p>
                </div>
                <span className="rounded-full border border-brand-red/20 bg-brand-red/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-red">
                  Current Term
                </span>
              </div>

              {courseProgressList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
                  <BookOpenIcon />
                  <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">No enrolled modules recorded yet</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Your learning progress will appear here after your curriculum is assigned.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {courseProgressList.map((track) => (
                    <CircularProgress
                      key={track.label}
                      percentage={track.percentage}
                      label={track.label}
                      modulesDone={track.modulesDone}
                      modulesTotal={track.modulesTotal}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 lg:col-span-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Upcoming Assessments</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Deadlines and tests recorded in your portal.</p>
                </div>
                <Trophy size={16} className="text-brand-red" aria-hidden="true" />
              </div>
              {upcomingAssignments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
                  <CheckCircle2 className="mx-auto text-slate-300 dark:text-slate-700" size={28} aria-hidden="true" />
                  <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">No pending assessments</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Assessment dates will appear here when scheduled.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingAssignments.map((exam) => (
                    <div key={exam.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
                          <Code2 size={15} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{exam.title}</p>
                          <p className="truncate text-[10px] text-slate-500">{exam.subject || 'Assessment'}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-lg bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700">
                        {formatDate(exam.dueDate)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <StudentAnalyticsVisualizer
            studentName={student.fullName || 'Student'}
            studentClass={student.class || student.grade || 'Not recorded'}
            enrolledSubjects={student.subjects || []}
            completedModulesCount={completedModulesCount}
            totalModulesCount={modules.length}
            learningTracks={courseProgressList.map((track) => ({
              subject: track.label,
              progress: track.percentage,
              modulesDone: track.modulesDone,
              modulesTotal: track.modulesTotal,
            }))}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 lg:col-span-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Recent Activity</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Latest verified module completions.</p>
                </div>
                <Activity size={16} className="text-brand-red" aria-hidden="true" />
              </div>
              {recentActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
                  <Activity className="mx-auto text-slate-300 dark:text-slate-700" size={26} aria-hidden="true" />
                  <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">No completed activities yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentActivities.map((module) => (
                    <div key={module.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="mt-0.5 rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600">
                        <Award size={14} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Completed Module</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{module.title}</p>
                        <p className="mt-0.5 text-[10px] font-mono text-slate-400">{module.completionDate || 'Completion recorded'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 lg:col-span-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
                    <Trophy size={16} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Active Milestone Focus</h2>
                    <p className="mt-0.5 text-xs text-slate-500">The next curriculum checkpoint from your recorded modules.</p>
                  </div>
                </div>
                {currentModule && (
                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Stage {currentModule.stageNumber}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Next Deliverable</p>
                  <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
                    {upcomingAssignments[0]?.title || 'No upcoming deliverable recorded'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{formatDate(upcomingAssignments[0]?.dueDate)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Certificate Readiness</p>
                  <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{overallProgress}%</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{completedModulesCount} of {modules.length} milestones verified</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <span className="text-slate-500">Primary Track: <strong className="text-slate-800 dark:text-slate-200">{student.plan || 'Coding & Tech Academy'}</strong></span>
                <span className="text-slate-500">Assigned Class: <strong className="text-slate-800 dark:text-slate-200">{student.class || student.grade || 'Not recorded'}</strong></span>
              </div>
            </section>
          </div>

          <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
            <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                  <Award size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Program Modules & Certificates</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Generate certificates only for modules that have a verified completion record.</p>
                </div>
              </div>
              <span className="self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                {completedModulesCount} of {modules.length} Completed
              </span>
            </div>

            {modules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
                <Award className="mx-auto text-slate-300 dark:text-slate-700" size={28} aria-hidden="true" />
                <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">No program milestones assigned yet</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Your instructor will record your curriculum stages here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => {
                  const credentialId = stableCredentialId(
                    student.username || student.accessCode || student.id || 'student',
                    module.id
                  );
                  return (
                    <article
                      key={module.id}
                      className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                        module.completed
                          ? 'border-brand-red/20 bg-brand-red/[0.02] dark:bg-brand-red/[0.04]'
                          : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40'
                      }`}
                    >
                      <div>
                        <div className="mb-2.5 flex items-start justify-between gap-2">
                          <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:bg-slate-800">
                            {module.stageName}
                          </span>
                          {module.completed ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <CheckCircle2 size={11} aria-hidden="true" /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              <Clock size={11} aria-hidden="true" /> In progress
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold leading-snug text-slate-900 dark:text-white">{module.title}</h3>
                        <p className="mt-0.5 text-xs font-semibold text-brand-red">{module.trackName}</p>
                        {module.competencies.length > 0 && (
                          <div className="mt-3">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recorded Competencies</p>
                            <div className="flex flex-wrap gap-1">
                              {module.competencies.slice(0, 5).map((competency) => (
                                <span key={competency} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {competency}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <div className="mb-2.5 flex items-center justify-between gap-3 text-[10px] text-slate-500">
                          <span>{module.completionDate ? `Verified ${formatDate(module.completionDate)}` : 'Verification pending'}</span>
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{module.score || '—'}</span>
                        </div>
                        {module.completed ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedModuleForCert(module);
                                setCertStudentName(student.fullName || '');
                              }}
                              className="min-h-9 flex-1 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:bg-slate-800 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-950"
                            >
                              Customize & Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadCertificate(module)}
                              disabled={generatingCert}
                              title="Download certificate PDF"
                              aria-label={`Download certificate for ${module.title}`}
                              className="min-h-9 min-w-9 rounded-xl bg-brand-red px-2.5 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-950"
                            >
                              <Download size={14} className="mx-auto" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="min-h-9 w-full rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-400 dark:bg-slate-800/60 dark:text-slate-500"
                          >
                            Milestone in progress
                          </button>
                        )}
                        <p className="mt-1.5 text-[9px] font-mono text-slate-400">{credentialId}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <AchievementBadgeGrid
            studentName={student.fullName}
            title="My Achievement & Mastery Badges"
            subtitle="Earn verifiable badges and XP as you complete milestones and projects."
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
                      <Video size={16} aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Live Classroom & Sessions</h2>
                      <p className="mt-0.5 text-xs text-slate-500">Links published specifically for your student account.</p>
                    </div>
                  </div>
                </div>

                {personalLinks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
                    <Video size={26} className="mx-auto text-slate-300 dark:text-slate-700" aria-hidden="true" />
                    <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">No live classroom links yet</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Your tutor will publish meeting links here before scheduled sessions.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {personalLinks.map((link) => (
                      <article key={link.id} className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="rounded-md bg-brand-red/10 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-red">{link.platform || 'Class Link'}</span>
                            {link.meetingTime && <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Clock size={11} aria-hidden="true" />{link.meetingTime}</span>}
                          </div>
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white">{link.title}</h3>
                          {link.description && <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{link.description}</p>}
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3.5 inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-brand-red px-3 text-xs font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-950"
                        >
                          Join Classroom <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section id="student-learning-materials" className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                      <FileText size={16} aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Learning Materials</h2>
                      <p className="mt-0.5 text-xs text-slate-500">Personal, class-specific, and school-assigned curriculum resources.</p>
                    </div>
                  </div>
                  <Link
                    to="/portal/student/resources"
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold text-brand-red hover:bg-brand-red/5 focus:outline-none focus:ring-2 focus:ring-brand-red"
                  >
                    Full Resource Library <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>

                <ResourceListView
                  resources={allStudentResources}
                  role="student"
                  studentClass={student?.class || student?.grade}
                  onPreview={(item) => {
                    const url = item.url || item.fileUrl;
                    if (url) window.open(url, '_blank');
                  }}
                  emptyMessage="No learning materials recorded yet. Resources assigned to your class or school will appear here."
                />
              </section>

              <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Trophy size={16} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Active Assessments & Quizzes</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Exams and evaluation tests currently visible to your portal.</p>
                  </div>
                </div>
                {exams.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
                    <p className="text-xs text-slate-500">No active assessments are currently recorded for your account.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {exams.slice(0, 6).map((exam) => (
                      <article key={exam.id} className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{exam.subject || 'Assessment'}</span>
                            {(exam.targetClass || exam.class) && <span className="rounded-md bg-brand-red/10 px-2 py-0.5 text-[10px] font-bold text-brand-red">{exam.targetClass || exam.class}</span>}
                          </div>
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white">{exam.title}</h3>
                          {exam.duration && <p className="mt-0.5 text-[10px] text-slate-500">Duration: {exam.duration}</p>}
                          {exam.passcodeProtected && <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300"><Lock size={11} aria-hidden="true" /> Passcode required</p>}
                        </div>
                        {exam.link || exam.url ? (
                          <a
                            href={exam.link || exam.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3.5 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:bg-slate-800 dark:focus:ring-offset-slate-950"
                          >
                            Start Test <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="mt-3.5 text-xs font-semibold text-slate-400">Link not published</span>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-6">
              <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Cadet Profile</h2>
                <div className="mt-3 space-y-0.5 text-xs">
                  <ProfileRow label="Username" value={student.username || '—'} mono />
                  <ProfileRow label="Assigned Class" value={student.class || student.grade || '—'} />
                  <ProfileRow label="School Partner" value={student.schoolName || '—'} />
                  <ProfileRow label="Primary Track" value={student.plan || '—'} />
                  {(student.accessCode || student.passcode) && <ProfileRow label="Access Code" value={student.accessCode || student.passcode || '—'} mono highlight />}
                  <ProfileRow label="Status" value={student.status || 'Active Learner'} highlightSuccess />
                  {student.notes && (
                    <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      <span className="font-bold">Mentor Remarks</span>
                      <p className="mt-0.5 text-[11px]">{student.notes}</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-white dark:bg-[#161B26] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-brand-red" aria-hidden="true" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Announcements</h2>
                  </div>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-brand-red text-white text-[10px] font-black">
                      {unreadCount} Unread
                    </span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500">No announcements currently.</p>
                ) : (
                  <div className="space-y-2.5">
                    {notifications.slice(0, 5).map((notification) => {
                      const isRead = isNotificationRead(notification);
                      return (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => openDrawer(notification.id)}
                          className={`w-full rounded-xl border p-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red cursor-pointer ${
                            isRead
                              ? 'border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 hover:bg-slate-100/70 dark:hover:bg-slate-850'
                              : 'border-brand-red/30 bg-brand-red/[0.04] text-slate-900 dark:border-brand-red/30 dark:bg-brand-red/[0.08] dark:text-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`text-xs font-bold ${!isRead ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                              {notification.title}
                            </span>
                            {!isRead && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" aria-label="Unread" />}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2 dark:text-slate-400">{notification.message}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </aside>
          </div>

          {selectedModuleForCert && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="certificate-modal-title">
              <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-red">Certificate Preview</p>
                    <h2 id="certificate-modal-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">{selectedModuleForCert.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">{selectedModuleForCert.stageName} · {selectedModuleForCert.trackName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedModuleForCert(null)}
                    className="min-h-11 min-w-11 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-red dark:hover:bg-slate-800 dark:hover:text-white"
                    aria-label="Close certificate preview"
                  >
                    <X size={18} className="mx-auto" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-brand-red">{selectedModuleForCert.stageName}</span>
                    <span className="font-mono text-slate-500">
                      {stableCredentialId(student.username || student.accessCode || student.id || 'student', selectedModuleForCert.id)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{selectedModuleForCert.title}</p>
                  <p className="mt-1 text-xs text-slate-500">Instructor: {selectedModuleForCert.instructor || 'Academic Directorate'}</p>
                  <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">Verified completion: {formatDate(selectedModuleForCert.completionDate)}</p>
                </div>

                <div className="mt-5">
                  <label htmlFor="certificate-student-name" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Student Name
                  </label>
                  <input
                    id="certificate-student-name"
                    type="text"
                    value={certStudentName}
                    onChange={(event) => setCertStudentName(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    autoComplete="name"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Use the exact spelling you want printed on the PDF certificate.</p>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedModuleForCert(null)}
                    className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-red dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={generatingCert || !certStudentName.trim()}
                    onClick={() => handleDownloadCertificate(selectedModuleForCert, certStudentName)}
                    className="min-h-11 flex-1 rounded-xl bg-brand-red px-4 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    {generatingCert ? 'Generating PDF…' : 'Download Certificate'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ProfileRow: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  highlightSuccess?: boolean;
}> = ({ label, value, mono = false, highlight = false, highlightSuccess = false }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 dark:border-slate-800">
    <span className="text-xs text-slate-500">{label}</span>
    <span
      className={`max-w-[58%] text-right text-xs font-bold ${
        mono ? 'font-mono' : ''
      } ${
        highlight
          ? 'rounded-md bg-brand-red/10 px-2 py-1 text-brand-red'
          : highlightSuccess
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-800 dark:text-slate-200'
      }`}
    >
      {value}
    </span>
  </div>
);

const BookOpenIcon = () => (
  <svg className="mx-auto text-slate-300 dark:text-slate-700" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 4.8A2.8 2.8 0 0 1 4.8 2H12v18H4.8A2.8 2.8 0 0 0 2 22V4.8Z" />
    <path d="M22 4.8A2.8 2.8 0 0 0 19.2 2H12v18h7.2a2.8 2.8 0 0 1 2.8 2V4.8Z" />
  </svg>
);

export default StudentDashboard;
