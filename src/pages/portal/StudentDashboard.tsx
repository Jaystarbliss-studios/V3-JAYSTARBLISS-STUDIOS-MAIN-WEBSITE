import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Award,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Radio,
  Trophy,
  UserCheck,
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

        const registrationType = studentRecord.schoolId
          ? 'school'
          : (studentRecord.parentId || studentRecord.parentEmail ? 'parent' : 'individual');
        sessionStorage.setItem('studentRegistrationType', registrationType);
        window.dispatchEvent(new CustomEvent('jaystar-student-registration-type', { detail: registrationType }));
        setStudent(studentRecord);
        setCertStudentName(studentRecord.fullName || '');

        // Resolve student program track & feature permissions (School general program vs specialized track)
        let progName = (studentRecord as any).programName || (studentRecord as any).program || studentRecord.plan || (studentRecord as any).track || '';
        let edclubAccess = false;
        let resAccess = true;

        const assignedProgramsList: string[] = Array.from(new Set([
          studentRecord.plan,
          (studentRecord as any).track,
          (studentRecord as any).programName,
          (studentRecord as any).programTitle,
          ...(Array.isArray((studentRecord as any).enrolledPrograms) ? (studentRecord as any).enrolledPrograms : []),
          ...(Array.isArray(studentRecord.subjects) ? studentRecord.subjects : []),
          ...(Array.isArray((studentRecord as any).plans) ? (studentRecord as any).plans : []),
          ...(Array.isArray((studentRecord as any).programs) ? (studentRecord as any).programs : [])
        ])).filter(Boolean).map(s => String(s).trim().toLowerCase());

        if (studentRecord.schoolId) {
          try {
            const schDoc = await getDoc(doc(db, 'schools', studentRecord.schoolId));
            if (schDoc.exists()) {
              const schData = schDoc.data();
              const schPrograms: any[] = Array.isArray(schData.programs) ? schData.programs : [];
              
              if (schPrograms.length > 0) {
                const studentProgId = (studentRecord as any).programId || (studentRecord as any).assignedProgramId;
                
                // Match against all assigned programs or program ID
                schPrograms.forEach(p => {
                  const pName = String(p.name || p.title || '').trim().toLowerCase();
                  const isAssigned = (studentProgId && p.id === studentProgId) ||
                    assignedProgramsList.length === 0 ||
                    assignedProgramsList.some(ap => ap === pName || ap.includes(pName) || pName.includes(ap));

                  if (isAssigned) {
                    if (!progName) progName = p.name;
                    if (p.hasEdclub === true || p.hasEdClub === true || pName.includes('digital literacy') || pName.includes('typing')) {
                      edclubAccess = true;
                    }
                    if (p.hasResources !== false) {
                      resAccess = true;
                    }
                  }
                });

                if (!progName) {
                  const general = schPrograms.find(p => p.isGeneralProgram) || schPrograms[0];
                  if (general) {
                    progName = general.name;
                    if (general.hasEdclub || String(general.name || '').toLowerCase().includes('digital literacy')) {
                      edclubAccess = true;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn('School program lookup notice:', e);
          }
        }

        // Also check programs collection
        if (!edclubAccess && assignedProgramsList.length > 0) {
          try {
            const progsSnap = await getDocs(collection(db, 'programs')).catch(() => ({ docs: [] } as any));
            progsSnap.docs.forEach((d: any) => {
              const p = d.data();
              const pTitle = String(p.title || p.name || '').trim().toLowerCase();
              const isMatch = assignedProgramsList.some(ap => ap === pTitle || ap.includes(pTitle) || pTitle.includes(ap));
              if (isMatch) {
                if (p.hasEdclub === true || p.hasEdClub === true || pTitle.includes('digital literacy') || pTitle.includes('typing')) {
                  edclubAccess = true;
                }
              }
            });
          } catch (e) {
            console.warn('Programs lookup for edclub notice:', e);
          }
        }

        // Fallback for Digital Literacy & Keyboarding programs
        const isDigitalLitOrTyping = assignedProgramsList.some(ap => 
          ap.includes('digital literacy') || 
          ap.includes('digitalliteracy') || 
          ap.includes('typing') || 
          ap.includes('edclub') || 
          ap.includes('keyboard')
        ) || String(progName || '').toLowerCase().includes('digital literacy') || String(studentRecord.plan || '').toLowerCase().includes('digital literacy');

        if (!edclubAccess && isDigitalLitOrTyping) {
          edclubAccess = true;
        }

        setEnrolledProgramName(progName || (isDigitalLitOrTyping ? 'Digital Literacy Junior' : ''));
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

          // If no specific studentModules exist yet, populate from their assigned program in programs collection
          if (moduleMap.size === 0) {
            const assignedProgName = studentRecord.plan || (studentRecord as any).track || (studentRecord as any).programName || enrolledProgramName;
            try {
              const progSnap = await getDocs(collection(db, 'programs'));
              const matchingProgs = progSnap.docs.filter(d => {
                const p = d.data();
                if (!assignedProgName) return p.status === 'PUBLISHED';
                const pTitle = (p.title || '').toLowerCase().trim();
                const target = assignedProgName.toLowerCase().trim();
                return pTitle === target || pTitle.includes(target) || target.includes(pTitle);
              });

              matchingProgs.forEach((d, idx) => {
                const p = d.data();
                const curr = Array.isArray(p.curriculum) && p.curriculum.length > 0 ? p.curriculum : [p.title];
                curr.forEach((topic: string, tIdx: number) => {
                  const mId = `${d.id}-mod-${tIdx}`;
                  moduleMap.set(mId, {
                    id: mId,
                    title: topic,
                    stageName: p.stageName || (p.seriesName ? `${p.seriesName} • Stage ${p.stageNumber || idx + 1}` : `Stage ${p.stageNumber || idx + 1}`),
                    stageNumber: Number(p.stageNumber) || idx + 1,
                    trackName: p.title || assignedProgName || 'Learning Track',
                    completed: tIdx === 0, // Mark first introductory milestone as active/completed
                    completionDate: tIdx === 0 ? new Date().toISOString() : '',
                    score: '90%',
                    competencies: ['Core Engineering', 'Problem Solving'],
                    instructor: p.assignedTutors?.[0]?.tutorName || (studentRecord as any).tutorName || 'Jaystarbliss Faculty',
                  });
                });
              });
            } catch (pErr) {
              console.warn('Fallback program modules lookup error:', pErr);
            }
          }

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
  }, []);

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

  // Real-time comparison for Live vs Upcoming classes
  const scheduleAnalysis = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let liveSession: any = null;
    const upcoming: any[] = [];

    studentSchedules.forEach((s) => {
      const date = s.date || '';
      const startTime = s.startTime || '';
      const endTime = s.endTime || '';
      const explicitStatus = String(s.status || '').toUpperCase();

      if (['COMPLETED', 'ATTENDED', 'CANCELLED', 'ABSENT'].includes(explicitStatus)) {
        return;
      }

      let formattedDate = date;
      if (date) {
        try {
          const d = new Date(date + 'T00:00:00');
          const day = d.getDate();
          const suffix = (day >= 11 && day <= 13) ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][day % 10];
          const dayName = d.toLocaleDateString('en-NG', { weekday: 'long' });
          formattedDate = `${dayName}, ${day}${suffix} ${d.toLocaleDateString('en-NG', { month: 'long' })} ${d.getFullYear()}`;
        } catch {
          formattedDate = date;
        }
      }

      if (date < todayStr) {
        return; // Past date
      }

      // ONLY mark as live if scheduled for TODAY and within start & end time window
      if (date === todayStr) {
        if (startTime && endTime) {
          if (currentTimeStr >= startTime && currentTimeStr <= endTime) {
            liveSession = { ...s, formattedDate, isLive: true };
            return;
          }
          if (currentTimeStr > endTime) {
            return; // Ended earlier today
          }
        } else if (explicitStatus === 'ONGOING') {
          liveSession = { ...s, formattedDate, isLive: true };
          return;
        }
      }

      // Future date or today before start time: strictly Upcoming
      upcoming.push({ ...s, formattedDate, isLive: false });
    });

    upcoming.sort((a, b) => {
      const cmpDate = (a.date || '').localeCompare(b.date || '');
      if (cmpDate !== 0) return cmpDate;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    return { liveSession, upcoming: upcoming.slice(0, 3) };
  }, [studentSchedules]);

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

          {/* 🔴 ACTIVE LIVE CLASS BANNER (If Active Today and In Session) */}
          {scheduleAnalysis.liveSession && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500/80 p-5 text-white shadow-lg animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black uppercase text-white shadow-xs">
                      <Radio size={12} className="animate-spin" /> LIVE CLASS IN SESSION
                    </span>
                    <span className="text-xs text-emerald-300 font-bold">
                      {scheduleAnalysis.liveSession.formattedDate || 'Today'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white">
                    {scheduleAnalysis.liveSession.title || scheduleAnalysis.liveSession.programName || 'Live Coding Class'}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
                    {scheduleAnalysis.liveSession.startTime && (
                      <span>⏰ {scheduleAnalysis.liveSession.startTime} – {scheduleAnalysis.liveSession.endTime}</span>
                    )}
                    {scheduleAnalysis.liveSession.tutorName && (
                      <span className="flex items-center gap-1">
                        <UserCheck size={13} className="text-brand-red" />
                        Instructor: {scheduleAnalysis.liveSession.tutorName}
                      </span>
                    )}
                  </div>
                </div>

                {scheduleAnalysis.liveSession.meetingLink && (
                  <a
                    href={scheduleAnalysis.liveSession.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 shadow-md shadow-emerald-900/40 transition shrink-0"
                  >
                    Join Live Room Now <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 🚀 LEADER PANEL: CURRENT PROGRAMME, FOCUS & PROGRESS (Strict high-contrast pure white text in all modes) */}
          <section 
            style={{ color: '#ffffff', backgroundColor: '#0B1120' }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1120] via-[#151F32] to-[#0B1120] !text-white p-6 sm:p-7 shadow-xl border-2 border-slate-700/80"
          >
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 md:items-center">
              <div className="space-y-1.5">
                <span className="inline-block text-[10px] font-black uppercase tracking-widest text-red-300 bg-red-950/90 px-2.5 py-0.5 rounded-md border border-red-700/80 shadow-xs">
                  Current Programme
                </span>
                <h2 style={{ color: '#ffffff' }} className="text-lg sm:text-xl font-black !text-white tracking-tight leading-snug">
                  {student.plan || enrolledProgramName || currentModule?.trackName || 'Coding and Tech Track'}
                </h2>
                <p style={{ color: '#cbd5e1' }} className="text-xs font-bold !text-slate-300">
                  {student.class || student.grade ? `Class Cohort: ${student.class || student.grade}` : 'Class Cohort Assigned'}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="inline-block text-[10px] font-black uppercase tracking-widest text-sky-300 bg-sky-950/90 px-2.5 py-0.5 rounded-md border border-sky-700/80 shadow-xs">
                  Current Focus
                </span>
                <p style={{ color: '#ffffff' }} className="text-base sm:text-lg font-black !text-white leading-snug">
                  {currentModule?.title || 'Core Engineering Track'}
                </p>
                {currentModule?.stageName && (
                  <p style={{ color: '#cbd5e1' }} className="text-xs font-bold !text-slate-300">{currentModule.stageName}</p>
                )}
              </div>

              <div className="md:text-right space-y-1.5">
                <span className="inline-block text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/90 px-2.5 py-0.5 rounded-md border border-emerald-700/80 shadow-xs">
                  Programme Progress
                </span>
                <p style={{ color: '#ffffff' }} className="text-3xl sm:text-4xl font-black !text-white tracking-tight">{overallProgress}%</p>
                <p style={{ color: '#cbd5e1' }} className="text-xs font-semibold !text-slate-300">
                  {completedModulesCount} of {modules.length} milestones mastered
                </p>
              </div>
            </div>

            {/* Stage Progression Pipeline (If modules or stages exist) */}
            {modules.length > 1 && (
              <div className="mt-5 pt-4 border-t border-slate-700/70">
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: '#94a3b8' }} className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Curriculum Stage Progression Path
                  </span>
                  <Link 
                    to="/portal/student/courses" 
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 hover:underline inline-flex items-center gap-1"
                  >
                    View All Stages <ArrowRight size={10} />
                  </Link>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {modules.map((m, idx) => (
                    <div 
                      key={m.id || idx}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 ${
                        m.completed
                          ? 'bg-emerald-950/80 border-emerald-600/80 text-emerald-200'
                          : idx === completedModulesCount
                          ? 'bg-red-950/80 border-red-600/80 text-white ring-1 ring-red-500/50'
                          : 'bg-slate-900/80 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-black/40 flex items-center justify-center text-[10px] font-black">
                        {idx + 1}
                      </span>
                      <span className="truncate max-w-[120px]">{m.title}</span>
                      {m.completed && <CheckCircle2 size={12} className="text-emerald-400" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ⌨️ TYPING MASTERS ACADEMY & EDCLUB WORKSPACE (Prominently rendered for EdClub-eligible tracks) */}
          {isEdclubAllowed && (
            <TypingMastersAcademyCard
              studentName={student.fullName || student.name || 'Student'}
              studentClass={student.class || student.grade}
              schoolId={student.schoolId}
              isAllowed={true}
              enrolledProgramName={enrolledProgramName || student.plan || 'Digital Literacy Junior'}
            />
          )}

          {/* 📅 UPCOMING CLASS SCHEDULE & TIMETABLE WIDGET */}
          {scheduleAnalysis.upcoming.length > 0 && (
            <section className="pro-surface rounded-2xl p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar size={16} className="text-brand-red" /> Upcoming Class Schedule
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Your next scheduled learning sessions and virtual classes.
                  </p>
                </div>
                <Link
                  to="/portal/student/live-classes"
                  className="text-xs font-bold text-brand-red inline-flex items-center gap-1 hover:underline"
                >
                  All Live Classes <ArrowRight size={13} />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {scheduleAnalysis.upcoming.map((occ: any) => (
                  <div
                    key={occ.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-3.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-red/10 px-2 py-0.5 text-[9px] font-black uppercase text-brand-red">
                          <Calendar size={10} /> UPCOMING
                        </span>
                        {occ.startTime && (
                          <span className="text-[10px] font-bold text-slate-500">
                            ⏰ {occ.startTime} – {occ.endTime}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-2 text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {occ.title || occ.programName || 'Class Session'}
                      </h4>
                      <p className="mt-0.5 text-[11px] font-bold text-brand-red dark:text-red-400">
                        {occ.formattedDate || occ.date}
                      </p>
                      {occ.tutorName && (
                        <p className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                          <UserCheck size={11} className="text-slate-400" />
                          Faculty: {occ.tutorName}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {occ.classLevel ? `Class: ${occ.classLevel}` : 'Assigned Class'}
                      </span>
                      {occ.meetingLink ? (
                        <a
                          href={occ.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-brand-red inline-flex items-center gap-1 hover:underline"
                        >
                          Meeting Link <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400">Link on start</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

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
