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
import { TypingMastersAcademyCard } from '../../components/portal/TypingMastersAcademyCard';
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
  name?: string;
  username?: string;
  email?: string;
  parentId?: string;
  parentEmail?: string;
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
  const [studentSchedules, setStudentSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState<'ALL' | 'CLASS' | 'GENERAL'>('ALL');
  const [selectedModuleForCert, setSelectedModuleForCert] = useState<ProgramModule | null>(null);
  const [certStudentName, setCertStudentName] = useState('');
  const [generatingCert, setGeneratingCert] = useState(false);
  const [enrolledProgramName, setEnrolledProgramName] = useState('');
  const [isEdclubAllowed, setIsEdclubAllowed] = useState(true);
  const [hasResourcesAllowed, setHasResourcesAllowed] = useState(true);

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

        // Resolve student program track & feature permissions (School general program vs specialized track)
        let progName = (studentRecord as any).programName || (studentRecord as any).program || studentRecord.plan || (studentRecord as any).track || '';
        let edclubAccess = true;
        let resAccess = true;

        if (studentRecord.schoolId) {
          try {
            const schDoc = await getDoc(doc(db, 'schools', studentRecord.schoolId));
            if (schDoc.exists()) {
              const schData = schDoc.data();
              const schPrograms: any[] = Array.isArray(schData.programs) ? schData.programs : [];
              
              if (schPrograms.length > 0) {
                const studentProgId = (studentRecord as any).programId || (studentRecord as any).assignedProgramId;
                let matched = schPrograms.find(p => p.id === studentProgId || (p.name && p.name.toLowerCase() === progName.toLowerCase()));
                if (!matched) {
                  // Fall back to school general program or first program
                  matched = schPrograms.find(p => p.isGeneralProgram) || schPrograms[0];
                }
                if (matched) {
                  progName = matched.name || progName;
                  // If hasEdclub is explicitly defined on the program
                  edclubAccess = Boolean(matched.hasEdclub);
                  resAccess = matched.hasResources !== false;
                }
              }
            }
          } catch (e) {
            console.warn('School program lookup notice:', e);
          }
        } else if ((studentRecord as any).programId) {
          try {
            const progDoc = await getDoc(doc(db, 'programs', (studentRecord as any).programId));
            if (progDoc.exists()) {
              const pData = progDoc.data();
              progName = pData.title || pData.name || progName;
              edclubAccess = Boolean(pData.hasEdclub);
              resAccess = pData.hasResources !== false;
            }
          } catch (e) {
            console.warn('Program lookup notice:', e);
          }
        }

        setEnrolledProgramName(progName || '');
        setIsEdclubAllowed(edclubAccess);
        setHasResourcesAllowed(resAccess);

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

        // Fetch student class schedules (matching school + class, parent schedule, or private student ID)
        try {
          const schSnap = await getDocs(collection(db, 'classSchedules')).catch(() => ({ docs: [] } as any));
          const list = schSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          const studentClass = (studentRecord?.class || studentRecord?.grade || cachedClass || '').trim().toLowerCase();
          const schId = studentRecord?.schoolId;
          const sName = (studentRecord?.fullName || studentRecord?.name || '').trim().toLowerCase();
          const sEmail = (studentRecord?.email || '').trim().toLowerCase();
          const pEmail = (studentRecord?.parentEmail || '').trim().toLowerCase();
          const pId = studentRecord?.parentId;

          const filtered = list.filter((r: any) => {
            // Match individual student
            if (r.studentId && (r.studentId === currentStudentId || r.studentId === lookupUid)) return true;
            if (r.studentEmail && sEmail && r.studentEmail.toLowerCase() === sEmail) return true;
            if (r.studentName && sName && r.studentName.toLowerCase() === sName) return true;

            // Match parent schedule
            if (pId && r.parentId && r.parentId === pId) return true;
            if (pEmail && r.parentEmail && r.parentEmail.toLowerCase() === pEmail) return true;

            // Match school schedule
            if (schId && r.schoolId === schId) {
              if (studentClass) {
                const rClass = String(r.classLevel || '').trim().toLowerCase();
                const rLevels = Array.isArray(r.classLevels) ? r.classLevels.map((l: string) => String(l).trim().toLowerCase()) : [];
                if (rClass && (rClass === studentClass || studentClass.includes(rClass) || rClass.includes(studentClass))) return true;
                if (rLevels.length > 0 && rLevels.some((l: string) => l === studentClass || studentClass.includes(l) || l.includes(studentClass))) return true;
                if (!rClass && rLevels.length === 0) return true;
              } else {
                return true;
              }
            }
            return false;
          });
          setStudentSchedules(filtered);
        } catch (err) {
          console.warn('Student class schedules fetch error:', err);
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
    let source: ResourceItem[] = [];
    if (resourceFilter === 'CLASS') source = classResources;
    else if (resourceFilter === 'GENERAL') source = generalResources;
    else source = [...personalResources, ...classResources, ...generalResources];

    const map = new Map<string, ResourceItem>();
    source.forEach(item => {
      if (item && item.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values());
  }, [classResources, generalResources, personalResources, resourceFilter]);

  const allStudentResources = useMemo(() => {
    const map = new Map<string, ResourceItem>();
    [...personalResources, ...classResources, ...generalResources].forEach((item) => {
      if (item && item.id && !map.has(item.id)) {
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
        description="A focused overview of your learning progress, programme assignment and class analytics."
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
          <Link to="/portal" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-red px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">
            Return to Portal <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <>
          <DashboardGreeting
            name={student.fullName || undefined}
            role="Student"
            subtitle="Your learning overview, kept focused on the things that matter most."
          />

          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 shadow-sm border border-slate-800">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 md:items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-red">Current Programme</p>
                <h2 className="mt-1 text-lg sm:text-xl font-bold text-white">
                  {student.plan || currentModule?.trackName || 'Not assigned'}
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  {student.class || student.grade ? `Class: ${student.class || student.grade}` : 'Class not assigned'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-red">Current Focus</p>
                <p className="mt-1 text-base font-bold text-white">
                  {currentModule?.title || 'Not assigned'}
                </p>
                {currentModule?.stageName && (
                  <p className="mt-1 text-xs text-slate-300">{currentModule.stageName}</p>
                )}
              </div>
              <div className="md:text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-red">Programme Progress</p>
                <p className="mt-1 text-3xl font-black text-white">{overallProgress}%</p>
                <p className="text-xs text-slate-300">{completedModulesCount} of {modules.length} milestones completed</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="pro-surface rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Programme Progress</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{overallProgress}%</p>
            </div>
            <div className="pro-surface rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Learning Tracks</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{courseProgressList.length}</p>
            </div>
            <div className="pro-surface rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Milestones</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{modules.length}</p>
            </div>
            <div className="pro-surface rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Completed</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{completedModulesCount}</p>
            </div>
          </div>

          {/* Typing Masters Academy • In Collaboration with EdClub */}
          <TypingMastersAcademyCard
            studentName={student.fullName}
            studentClass={student.class || student.grade}
            schoolId={student.schoolId}
            isAllowed={isEdclubAllowed}
            enrolledProgramName={enrolledProgramName}
          />

          <section className="pro-surface rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Learning Analytics</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Your recorded progress across assigned learning tracks.</p>
              </div>
              <Activity size={16} className="text-brand-red" aria-hidden="true" />
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
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="pro-surface rounded-2xl p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Learning Tracks</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Progress from your assigned modules.</p>
                </div>
                <Link to="/portal/student/courses" className="text-xs font-bold text-brand-red inline-flex items-center gap-1">
                  Open Learning <ArrowRight size={13} />
                </Link>
              </div>
              {courseProgressList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
                  <BookOpenIcon />
                  <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">No learning tracks assigned</p>
                  <p className="mt-1 text-[11px] text-slate-500">Your school administrator or instructor has not assigned a track yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {courseProgressList.map(track => (
                    <CircularProgress key={track.label} {...track} />
                  ))}
                </div>
              )}
            </section>

            <section className="pro-surface rounded-2xl p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Learning Activity</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Verified activity recorded for your account.</p>
                </div>
                <Award size={16} className="text-brand-red" aria-hidden="true" />
              </div>
              {recentActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">No completed activity yet</p>
                  <p className="mt-1 text-[11px] text-slate-500">Completed milestones will appear in the Achievements section.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentActivities.slice(0, 5).map(module => (
                    <div key={module.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <Award size={15} className="mt-0.5 text-emerald-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{module.title}</p>
                        <p className="text-[10px] text-slate-500">{module.completionDate ? `Completed ${formatDate(module.completionDate)}` : 'Completed'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
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
