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
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import SEO from '../../components/ui/SEO';
import { AchievementBadgeGrid } from '../../components/ecosystem/AchievementBadge';
import { DashboardGreeting } from '../../components/portal/DashboardGreeting';
import { StudentAnalyticsVisualizer } from '../../components/portal/StudentAnalyticsVisualizer';
import { useToast } from '../../contexts/ToastContext';
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

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  readBy?: string[];
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
  const [selectedModuleForCert, setSelectedModuleForCert] = useState<ProgramModule | null>(null);
  const [certStudentName, setCertStudentName] = useState('');
  const [generatingCert, setGeneratingCert] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchStudentData = async () => {
      setLoading(true);
      try {
        const currentUser = auth.currentUser;
        const studentDocId = sessionStorage.getItem('studentDocId');
        const studentUsername = sessionStorage.getItem('studentUsername');
        const cachedClass = sessionStorage.getItem('studentClass');

        let studentRecord: StudentInfo | null = null;
        let studentId = studentDocId || '';

        if (studentId) {
          try {
            const snap = await getDoc(doc(db, 'individualStudents', studentId));
            if (snap.exists()) {
              studentRecord = { id: snap.id, ...snap.data() } as StudentInfo;
            }
          } catch (error) {
            console.warn('Direct student lookup failed:', error);
          }
        }

        if (!studentRecord && currentUser) {
          try {
            const snap = await getDocs(
              query(collection(db, 'individualStudents'), where('firebaseUid', '==', currentUser.uid), limit(1))
            );
            if (!snap.empty) {
              studentId = snap.docs[0].id;
              studentRecord = { id: snap.docs[0].id, ...snap.docs[0].data() } as StudentInfo;
            }
          } catch (error) {
            console.warn('Firebase UID lookup failed:', error);
          }
        }

        if (!studentRecord && studentUsername) {
          try {
            const snap = await getDocs(
              query(
                collection(db, 'individualStudents'),
                where('username', '==', studentUsername.toLowerCase()),
                limit(1)
              )
            );
            if (!snap.empty) {
              studentId = snap.docs[0].id;
              studentRecord = { id: snap.docs[0].id, ...snap.docs[0].data() } as StudentInfo;
            }
          } catch (error) {
            console.warn('Username lookup failed:', error);
          }
        }

        if (cancelled) return;

        if (!studentRecord) {
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
        resourceSnapshot.forEach((resourceDoc) => {
          const item = { id: resourceDoc.id, ...resourceDoc.data() } as ResourceItem;
          const itemClass = (item.targetClass || item.class || '').trim().toLowerCase();
          const target = assignedClass.toLowerCase();
          if (itemClass && target && (itemClass === target || itemClass.includes(target) || target.includes(itemClass))) {
            classList.push({ ...item, isClassSpecific: true });
          } else {
            generalList.push({ ...item, isClassSpecific: false });
          }
        });

        if (studentRecord.schoolId) {
          try {
            const schoolResourceSnap = await getDocs(
              query(collection(db, 'schoolResources'), where('schoolId', '==', studentRecord.schoolId), limit(20))
            );
            schoolResourceSnap.forEach((resourceDoc) => {
              const item = { id: resourceDoc.id, ...resourceDoc.data() } as ResourceItem;
              const itemClass = (item.targetClass || item.class || '').trim().toLowerCase();
              const target = assignedClass.toLowerCase();
              const destination = itemClass && target && (itemClass === target || itemClass.includes(target) || target.includes(itemClass))
                ? classList
                : generalList;
              if (!destination.some((resource) => resource.id === item.id)) {
                destination.push({ ...item, isClassSpecific: destination === classList });
              }
            });
          } catch (error) {
            console.warn('School resource lookup failed:', error);
          }
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
          const notificationQueries = [
            ...(currentUid
              ? [query(collection(db, 'notifications'), where('recipientId', '==', currentUid))]
              : []),
            query(collection(db, 'notifications'), where('recipientId', '==', currentStudentId)),
            query(collection(db, 'notifications'), where('recipientId', '==', 'all')),
            query(collection(db, 'notifications'), where('recipientId', '==', 'all_students')),
          ];
          const notificationSnapshots = await Promise.all(notificationQueries.map(getDocs));
          const notificationMap = new Map<string, NotificationItem>();
          notificationSnapshots.forEach((snap) => {
            snap.forEach((notificationDoc) => {
              notificationMap.set(notificationDoc.id, {
                id: notificationDoc.id,
                ...notificationDoc.data(),
              } as NotificationItem);
            });
          });
          setNotifications(Array.from(notificationMap.values()).slice(0, 10));
        } catch (error) {
          console.warn('Notification lookup failed:', error);
          setNotifications([]);
        }

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

  const markNotificationRead = async (notificationId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        readBy: Array.from(new Set([...(notifications.find((item) => item.id === notificationId)?.readBy || []), uid])),
      });
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? { ...item, readBy: Array.from(new Set([...(item.readBy || []), uid])) }
            : item
        )
      );
    } catch (error) {
      console.warn('Could not update notification state:', error);
    }
  };

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
            name={`Cadet ${student.fullName || 'Student'}`}
            role="STEM Cadet"
            subtitle="Track your enrolled courses, live classroom links, verified module certificates, assessments, and learning materials."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="pro-surface rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overall Progress</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{overallProgress}%</p>
              <p className="mt-1 text-xs text-slate-500">{completedModulesCount} of {modules.length} modules completed</p>
            </div>
            <div className="pro-surface rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Upcoming Assessments</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{exams.length}</p>
              <p className="mt-1 text-xs text-slate-500">Assessments currently available</p>
            </div>
            <div className="pro-surface rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Learning Resources</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{personalResources.length + classResources.length + generalResources.length}</p>
              <p className="mt-1 text-xs text-slate-500">Personal, class, and general materials</p>
            </div>
            <div className="pro-surface rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Announcements</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{notifications.length}</p>
              <p className="mt-1 text-xs text-slate-500">Messages visible in your workspace</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="pro-surface rounded-3xl p-6 lg:col-span-7 md:p-7">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Course Progress</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Verified module completion across active learning tracks.</p>
                </div>
                <span className="rounded-full border border-brand-red/20 bg-brand-red/10 px-2.5 py-1 text-[11px] font-bold text-brand-red">
                  Current Enrollment
                </span>
              </div>

              {courseProgressList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-950/50">
                  <BookOpenIcon />
                  <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">No enrolled modules recorded yet</p>
                  <p className="mt-1 text-xs text-slate-500">Your learning progress will appear here after your curriculum is assigned.</p>
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

            <section className="pro-surface rounded-3xl p-6 lg:col-span-5 md:p-7">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Upcoming Assessments</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Deadlines already recorded in your portal.</p>
                </div>
                <Trophy size={18} className="text-brand-red" aria-hidden="true" />
              </div>
              {upcomingAssignments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-950/50">
                  <CheckCircle2 className="mx-auto text-slate-300 dark:text-slate-700" size={32} aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">No dated assessments pending</p>
                  <p className="mt-1 text-xs text-slate-500">Assessment dates will appear here when assigned.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAssignments.map((exam) => (
                    <div key={exam.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                          <Code2 size={18} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{exam.title}</p>
                          <p className="truncate text-xs text-slate-500">{exam.subject || 'Assessment'}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200">
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
            <section className="pro-surface rounded-3xl p-6 lg:col-span-5 md:p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Recent Activity</h2>
                  <p className="mt-1 text-xs text-slate-500">Latest verified module completions.</p>
                </div>
                <Activity size={17} className="text-brand-red" aria-hidden="true" />
              </div>
              {recentActivities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center dark:border-slate-800 dark:bg-slate-950/50">
                  <Activity className="mx-auto text-slate-300 dark:text-slate-700" size={30} aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">No completed activities yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((module) => (
                    <div key={module.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="mt-0.5 rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                        <Award size={15} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Completed Module</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{module.title}</p>
                        <p className="mt-1 text-[10px] font-mono text-slate-400">{module.completionDate || 'Completion recorded'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="pro-surface rounded-3xl p-6 lg:col-span-7 md:p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                    <Trophy size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Active Milestone Focus</h2>
                    <p className="mt-1 text-xs text-slate-500">The next curriculum checkpoint from your recorded modules.</p>
                  </div>
                </div>
                {currentModule && (
                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Stage {currentModule.stageNumber}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Next Deliverable</p>
                  <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                    {upcomingAssignments[0]?.title || 'No upcoming deliverable recorded'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(upcomingAssignments[0]?.dueDate)}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Certificate Readiness</p>
                  <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">{overallProgress}%</p>
                  <p className="mt-1 text-xs text-slate-500">{completedModulesCount} of {modules.length} milestones verified</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
                <span className="text-slate-500">Primary Track: <strong className="text-slate-800 dark:text-slate-200">{student.plan || 'STEM & Coding Academy'}</strong></span>
                <span className="text-slate-500">Assigned Class: <strong className="text-slate-800 dark:text-slate-200">{student.class || student.grade || 'Not recorded'}</strong></span>
              </div>
            </section>
          </div>

          <section className="pro-surface rounded-3xl p-6 md:p-8">
            <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red">
                  <Award size={23} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Program Modules & Certificates</h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Generate certificates only for modules that have a verified completion record.</p>
                </div>
              </div>
              <span className="self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                {completedModulesCount} of {modules.length} Completed
              </span>
            </div>

            {modules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-950/50">
                <Award className="mx-auto text-slate-300 dark:text-slate-700" size={32} aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">No program milestones assigned yet</p>
                <p className="mt-1 text-xs text-slate-500">Your instructor will record your curriculum stages here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => {
                  const credentialId = stableCredentialId(
                    student.username || student.accessCode || student.id || 'student',
                    module.id
                  );
                  return (
                    <article
                      key={module.id}
                      className={`flex flex-col justify-between rounded-2xl border p-5 ${
                        module.completed
                          ? 'border-brand-red/20 bg-brand-red/[0.03] dark:bg-brand-red/[0.05]'
                          : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40'
                      }`}
                    >
                      <div>
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <span className="rounded-md bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white dark:bg-slate-800">
                            {module.stageName}
                          </span>
                          {module.completed ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <CheckCircle2 size={11} aria-hidden="true" /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              <Clock size={11} aria-hidden="true" /> In progress
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold leading-snug text-slate-900 dark:text-white">{module.title}</h3>
                        <p className="mt-1 text-xs font-semibold text-brand-red">{module.trackName}</p>
                        {module.competencies.length > 0 && (
                          <div className="mt-4">
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recorded Competencies</p>
                            <div className="flex flex-wrap gap-1.5">
                              {module.competencies.slice(0, 6).map((competency) => (
                                <span key={competency} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {competency}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
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
                              className="min-h-11 flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:bg-slate-800 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-950"
                            >
                              Customize & Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadCertificate(module)}
                              disabled={generatingCert}
                              title="Download certificate PDF"
                              aria-label={`Download certificate for ${module.title}`}
                              className="min-h-11 min-w-11 rounded-xl bg-brand-red px-3 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-950"
                            >
                              <Download size={15} className="mx-auto" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="min-h-11 w-full rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-400 dark:bg-slate-800/60 dark:text-slate-500"
                          >
                            Complete milestone to unlock certificate
                          </button>
                        )}
                        <p className="mt-2 text-[10px] font-mono text-slate-400">{credentialId}</p>
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
              <section className="pro-surface rounded-3xl p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                      <Video size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white">Live Classroom & Sessions</h2>
                      <p className="mt-1 text-xs text-slate-500">Links published specifically for your student account.</p>
                    </div>
                  </div>
                </div>

                {personalLinks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-950/50">
                    <Video size={30} className="mx-auto text-slate-300 dark:text-slate-700" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">No live classroom links yet</p>
                    <p className="mt-1 text-xs text-slate-500">Your tutor will publish meeting links here before scheduled sessions.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {personalLinks.map((link) => (
                      <article key={link.id} className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="rounded-md bg-brand-red/10 px-2 py-1 text-[10px] font-bold uppercase text-brand-red">{link.platform || 'Class Link'}</span>
                            {link.meetingTime && <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Clock size={11} aria-hidden="true" />{link.meetingTime}</span>}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{link.title}</h3>
                          {link.description && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{link.description}</p>}
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-red px-3 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:focus:ring-offset-slate-950"
                        >
                          Join Classroom <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="pro-surface rounded-3xl p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                      <FileText size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white">Learning Materials</h2>
                      <p className="mt-1 text-xs text-slate-500">Personal, class-specific, and general resources.</p>
                    </div>
                  </div>
                  <Link
                    to="/portal/student/resources"
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold text-brand-red hover:bg-brand-red/5 focus:outline-none focus:ring-2 focus:ring-brand-red"
                  >
                    Full Resource Library <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>

                <div className="mb-4 flex gap-2 overflow-x-auto border-b border-slate-100 pb-2 dark:border-slate-800">
                  {([
                    ['ALL', `All (${personalResources.length + classResources.length + generalResources.length})`],
                    ['CLASS', `Class (${classResources.length})`],
                    ['GENERAL', `General (${generalResources.length})`],
                  ] as const).map(([filter, label]) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setResourceFilter(filter)}
                      aria-pressed={resourceFilter === filter}
                      className={`min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold ${
                        resourceFilter === filter
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {displayedResources.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-950/50">
                    <FileText size={30} className="mx-auto text-slate-300 dark:text-slate-700" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">No materials in this view</p>
                    <p className="mt-1 text-xs text-slate-500">New learning resources will appear when they are published to your account.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedResources.slice(0, 8).map((resource) => (
                      <div key={`${resource.isClassSpecific ? 'class' : 'resource'}-${resource.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 rounded-xl bg-brand-red/10 p-2 text-brand-red">
                            <FileText size={15} aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap gap-1.5">
                              {resource.isClassSpecific && (
                                <span className="rounded-md bg-brand-red/10 px-2 py-1 text-[10px] font-bold uppercase text-brand-red">Class Material</span>
                              )}
                              {resource.type && <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">{resource.type}</span>}
                            </div>
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{resource.title}</p>
                            {resource.description && <p className="truncate text-xs text-slate-500">{resource.description}</p>}
                          </div>
                        </div>
                        {resource.url ? (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-brand-red hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-brand-red"
                          >
                            <Download size={13} aria-hidden="true" /> Access
                          </a>
                        ) : (
                          <span className="shrink-0 text-[10px] font-bold text-slate-400">No link</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="pro-surface rounded-3xl p-6">
                <div className="mb-5 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Trophy size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Active Assessments & Quizzes</h2>
                    <p className="mt-1 text-xs text-slate-500">Exams and evaluation tests currently visible to your portal.</p>
                  </div>
                </div>
                {exams.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center dark:border-slate-800 dark:bg-slate-950/50">
                    <p className="text-xs text-slate-500">No active assessments are currently recorded for your account.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {exams.slice(0, 6).map((exam) => (
                      <article key={exam.id} className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{exam.subject || 'Assessment'}</span>
                            {(exam.targetClass || exam.class) && <span className="rounded-md bg-brand-red/10 px-2 py-1 text-[10px] font-bold text-brand-red">{exam.targetClass || exam.class}</span>}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{exam.title}</h3>
                          {exam.duration && <p className="mt-1 text-xs text-slate-500">Duration: {exam.duration}</p>}
                          {exam.passcodeProtected && <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300"><Lock size={12} aria-hidden="true" /> Requires exam passcode</p>}
                        </div>
                        {exam.link || exam.url ? (
                          <a
                            href={exam.link || exam.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 dark:bg-slate-800 dark:focus:ring-offset-slate-950"
                          >
                            Start Test <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="mt-4 text-xs font-semibold text-slate-400">Assessment link not published</span>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-6">
              <section className="pro-surface rounded-3xl p-6">
                <h2 className="text-base font-black text-slate-900 dark:text-white">Cadet Profile</h2>
                <div className="mt-4 space-y-1 text-sm">
                  <ProfileRow label="Username" value={student.username || '—'} mono />
                  <ProfileRow label="Assigned Class" value={student.class || student.grade || '—'} />
                  <ProfileRow label="School Partner" value={student.schoolName || '—'} />
                  <ProfileRow label="Primary Track" value={student.plan || '—'} />
                  {(student.accessCode || student.passcode) && <ProfileRow label="Access Code" value={student.accessCode || student.passcode || '—'} mono highlight />}
                  <ProfileRow label="Status" value={student.status || 'Active Learner'} highlightSuccess />
                  {student.notes && (
                    <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      <span className="font-bold">Mentor Remarks</span>
                      <p className="mt-1">{student.notes}</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="pro-surface rounded-3xl p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Bell size={18} className="text-brand-red" aria-hidden="true" />
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Announcements</h2>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500">No announcements are currently visible.</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => {
                      const isRead = Boolean(auth.currentUser?.uid && notification.readBy?.includes(auth.currentUser.uid));
                      return (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => markNotificationRead(notification.id)}
                          className={`w-full rounded-2xl border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red ${
                            isRead
                              ? 'border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/50'
                              : 'border-brand-red/20 bg-brand-red/[0.04] text-slate-900 dark:border-brand-red/20 dark:bg-brand-red/[0.08] dark:text-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold">{notification.title}</span>
                            {!isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-red" aria-label="Unread" />}
                          </div>
                          <p className="mt-1 text-xs text-slate-600 line-clamp-3 dark:text-slate-300">{notification.message}</p>
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
