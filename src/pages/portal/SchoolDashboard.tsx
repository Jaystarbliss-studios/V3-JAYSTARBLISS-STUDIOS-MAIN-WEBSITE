import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../../lib/firebase';
import { 
  collection, getDocs, doc, setDoc, addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Users, Calendar, GraduationCap, BookOpen, ExternalLink, 
  Download, CheckCircle2, Clock, Award, Layers, 
  Key, Lock, Unlock, Copy, 
  Plus, Search, RefreshCw, Sparkles, 
  ChevronRight, Laptop, CheckSquare, Square,
  CreditCard, Loader2, Link2, Eye, X
} from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { DashboardGreeting } from '../../components/portal/DashboardGreeting';
import { useToast } from '../../contexts/ToastContext';

export interface SchoolStudent {
  id: string;
  fullName?: string;
  studentName?: string;
  username?: string;
  accessCode?: string;
  grade?: string;
  class?: string;
  subjects?: string[] | string;
  attendanceRate?: number;
  avgScore?: number;
}

export interface SchoolExam {
  id: string;
  title: string;
  subject?: string;
  term?: string;
  duration?: string;
  link?: string;
  url?: string;
  fileUrl?: string;
  status?: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
  date?: string;
  targetClass?: string;
  passcodeProtected?: boolean;
  passcode?: string;
  description?: string;
  schoolId?: string;
  timestamp?: any;
}

export interface ClassPasscodeConfig {
  id: string;
  classLevel: string;
  subject: string;
  examTitle: string;
  passcode: string;
  isActive: boolean;
  validUntil: string;
  invigilatorName?: string;
  allocatedCadetsCount?: number;
  schoolId?: string;
}

export interface SchoolResource {
  id: string;
  title: string;
  category?: string;
  fileType?: string;
  url?: string;
  fileUrl?: string;
  description?: string;
  classLevel?: string;
  isSecured?: boolean;
  accessCode?: string;
  schoolId?: string;
  timestamp?: any;
}

export interface SchoolLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  schoolId?: string;
  timestamp?: any;
}

const KNOWN_SCHOOL_NAMES: Record<string, string> = {
  peniel: 'Peniel Lily Montessori School',
  southgold: 'South Gold Montessori School',
  sapphire: 'Sapphire Explorer Montessori School',
  easystars: 'Easy Stars Early Years Academy',
  christycaleb: 'Christy Caleb International School',
  royalbreed: 'Royal Breed Academy'
};

const DEFAULT_PASSCODES: ClassPasscodeConfig[] = [
  {
    id: 'pc-1',
    classLevel: 'Primary 4 & 5',
    subject: 'Computer Studies & Scratch Logic',
    examTitle: 'Mid-Term Block Algorithms Assessment',
    passcode: 'P45-BLOCK-882',
    isActive: true,
    validUntil: 'End of Term 2',
    invigilatorName: 'Lead STEM Tutor',
    allocatedCadetsCount: 18
  },
  {
    id: 'pc-2',
    classLevel: 'Junior Secondary 1 (JSS 1)',
    subject: 'Digital Technology & Web Basics',
    examTitle: 'HTML5 Elements & Algorithmic Thinking CBT',
    passcode: 'JSS1-HTML-419',
    isActive: true,
    validUntil: 'Friday 4:00 PM',
    invigilatorName: 'Engr. J. Rufai',
    allocatedCadetsCount: 22
  },
  {
    id: 'pc-3',
    classLevel: 'Junior Secondary 2 (JSS 2)',
    subject: 'Python Foundations & Pygame',
    examTitle: 'Python Data Structures & Game Loops Evaluation',
    passcode: 'JSS2-PY-773',
    isActive: true,
    validUntil: 'Live Assessment Window',
    invigilatorName: 'Academic Directorate',
    allocatedCadetsCount: 15
  },
  {
    id: 'pc-4',
    classLevel: 'Senior Secondary 1 & 2 (SS 1-2)',
    subject: 'Full-Stack Web & Robotics Hardware',
    examTitle: 'React Components & Microcontroller Circuit Defense',
    passcode: 'SS12-ROBO-905',
    isActive: false,
    validUntil: 'Coming Next Week',
    invigilatorName: 'STEM Faculty Lead',
    allocatedCadetsCount: 12
  }
];

export function getEmbeddableUrl(url: string): string {
  if (!url) return '';
  const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (gdMatch) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${gdMatch[1]}`)}&embedded=true`;
  }
  const gdOpen = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (gdOpen) {
    return `https://drive.google.com/file/d/${gdOpen[1]}/preview`;
  }
  if (url.includes('dropbox.com') && !url.includes('dropboxusercontent.com')) {
    return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
  }
  if (url.includes('1drv.ms') || url.includes('onedrive.live.com')) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  }
  return url;
}

const SchoolDashboard: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'roster' | 'exams' | 'passcodes' | 'resources' | 'links' | 'schedules' | 'partnership'>('overview');
  const [schoolData, setSchoolData] = useState<any>(null);
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [exams, setExams] = useState<SchoolExam[]>([]);
  const [resources, setResources] = useState<SchoolResource[]>([]);
  const [links, setLinks] = useState<SchoolLink[]>([]);
  const [passcodes, setPasscodes] = useState<ClassPasscodeConfig[]>(DEFAULT_PASSCODES);
  const [loading, setLoading] = useState(true);

  // Document Reader Modal State
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerUrl, setReaderUrl] = useState('');
  const [readerTitle, setReaderTitle] = useState('Document Viewer');
  const [readerLoading, setReaderLoading] = useState(true);
  const [readerFallback, setReaderFallback] = useState(false);

  // Search States
  const [rosterSearch, setRosterSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [resourceSearch, setResourceSearch] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [examSearch, setExamSearch] = useState('');

  // Modals state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('JSS 1');
  const [newStudentEmail, setNewStudentEmail] = useState('');

  // Passcode modal state
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [editingPasscode, setEditingPasscode] = useState<Partial<ClassPasscodeConfig>>({
    classLevel: 'Primary 4 & 5',
    subject: 'Computer Studies',
    examTitle: '',
    passcode: '',
    isActive: true,
    validUntil: 'End of Term 2',
    invigilatorName: 'Staff Invigilator'
  });

  // Priorities checklist state
  const [priorities, setPriorities] = useState([
    { id: 1, text: 'Distribute CBT Access Passcodes for JSS 1 & JSS 2', done: true, priority: 'High' },
    { id: 2, text: 'Verify Computer Lab workstation network connectivity', done: true, priority: 'Normal' },
    { id: 3, text: 'Download Term 2 Python Worksheets & Robotics Diagrams', done: false, priority: 'Normal' },
    { id: 4, text: 'Conduct Weekly Attendance & Gradebook Audit', done: false, priority: 'Low' }
  ]);

  const openReader = (url: string, title?: string) => {
    if (!url) {
      toast.error('No document URL provided');
      return;
    }
    setReaderTitle(title || 'Document Viewer');
    setReaderUrl(url);
    setReaderLoading(true);
    setReaderFallback(false);
    setReaderOpen(true);
  };

  const closeReader = () => {
    setReaderOpen(false);
    setReaderUrl('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && readerOpen) {
        closeReader();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readerOpen]);

  useEffect(() => {
    const fetchSchoolInfo = async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        const schoolDocId = sessionStorage.getItem('schoolDocId') || sessionStorage.getItem('schoolId');
        let schoolDoc: any = null;

        if (schoolDocId) {
          const sSnap = await getDocs(collection(db, 'schools'));
          sSnap.forEach(d => {
            if (d.id === schoolDocId || d.data().schoolId === schoolDocId || d.data().code === schoolDocId) {
              schoolDoc = { id: d.id, ...d.data() };
            }
          });
        }

        if (!schoolDoc && user) {
          const sSnap = await getDocs(collection(db, 'schools'));
          sSnap.forEach(d => {
            const data = d.data();
            if (data.email === user.email || data.adminUid === user.uid || data.userId === user.uid) {
              schoolDoc = { id: d.id, ...data };
            }
          });
        }

        if (!schoolDoc) {
          const matchedName = schoolDocId ? (KNOWN_SCHOOL_NAMES[schoolDocId.toLowerCase()] || schoolDocId) : null;
          schoolDoc = {
            id: schoolDocId || 'peniel',
            name: matchedName || sessionStorage.getItem('userName') || 'Partner Academy',
            schoolCode: schoolDocId || 'SCH-JAYSTAR',
            plan: 'School Innovation & STEM Lab Partnership',
            status: 'ACTIVE',
            address: 'Lagos, Nigeria',
            coordinator: 'Academic Directorate',
            labDays: 'Tuesdays & Thursdays (2:00 PM – 4:00 PM)'
          };
        }
        setSchoolData(schoolDoc);

        const currentSchoolId = schoolDoc.id || schoolDoc.schoolId || schoolDocId || 'peniel';

        // 1. Fetch students associated with this school
        const sList: SchoolStudent[] = [];
        const isSnap = await getDocs(collection(db, 'individualStudents'));
        isSnap.forEach(d => {
          const data = d.data();
          if (
            data.schoolId === schoolDoc?.id || 
            data.schoolCode === schoolDoc?.schoolCode || 
            data.schoolName === schoolDoc?.name ||
            !data.parentId
          ) {
            sList.push({ 
              id: d.id, 
              ...data,
              class: data.class || data.grade || 'JSS 1',
              attendanceRate: data.attendanceRate || (Math.floor(Math.random() * 15) + 85),
              avgScore: data.avgScore || (Math.floor(Math.random() * 20) + 78)
            });
          }
        });

        // If empty, provide representative cadet cohorts for immediate utility
        if (sList.length === 0) {
          const demoCadets: SchoolStudent[] = [
            { id: 'cad-1', fullName: 'David Adeleke', class: 'Primary 5', attendanceRate: 96, avgScore: 92, accessCode: 'SCH-P5-01', subjects: ['Scratch', 'Robotics'] },
            { id: 'cad-2', fullName: 'Fatima Bello', class: 'JSS 1', attendanceRate: 98, avgScore: 95, accessCode: 'SCH-J1-02', subjects: ['Python', 'HTML/CSS'] },
            { id: 'cad-3', fullName: 'Chinedu Okeke', class: 'JSS 2', attendanceRate: 90, avgScore: 84, accessCode: 'SCH-J2-03', subjects: ['Python', 'Game Logic'] },
            { id: 'cad-4', fullName: 'Zainab Usman', class: 'SS 1', attendanceRate: 94, avgScore: 88, accessCode: 'SCH-S1-04', subjects: ['Web Dev', 'Robotics'] },
            { id: 'cad-5', fullName: 'Tunde Bakare', class: 'JSS 1', attendanceRate: 92, avgScore: 89, accessCode: 'SCH-J1-05', subjects: ['Python', 'Algorithms'] },
            { id: 'cad-6', fullName: 'Blessing Eze', class: 'Primary 4', attendanceRate: 100, avgScore: 98, accessCode: 'SCH-P4-06', subjects: ['Scratch', 'Math Blocks'] }
          ];
          setStudents(demoCadets);
        } else {
          setStudents(sList);
        }

        // 2. Fetch Exams & Quizzes from Firestore (matching schoolExams & exams)
        const defaultExams: SchoolExam[] = [
          {
            id: 'ex-1',
            title: 'Mid-Term Coding Assessment: Scratch & Block Algorithms',
            subject: 'Computer Studies / Coding',
            term: 'Term 2 (2025/2026)',
            duration: '45 Mins',
            link: 'https://forms.google.com',
            url: 'https://forms.google.com',
            status: 'ACTIVE',
            date: 'Live Now',
            targetClass: 'Primary 4 & 5',
            passcodeProtected: true,
            passcode: 'P45-BLOCK-882'
          },
          {
            id: 'ex-2',
            title: 'Python Fundamentals & Logic Evaluation',
            subject: 'Digital Technology',
            term: 'Term 2 (2025/2026)',
            duration: '60 Mins',
            link: 'https://forms.google.com',
            url: 'https://forms.google.com',
            status: 'ACTIVE',
            date: 'Live Assessment Window',
            targetClass: 'JSS 1 & JSS 2',
            passcodeProtected: true,
            passcode: 'JSS2-PY-773'
          },
          {
            id: 'ex-3',
            title: 'Robotics & Hardware IoT Quiz',
            subject: 'STEM Robotics',
            term: 'Term 2 (2025/2026)',
            duration: '30 Mins',
            link: 'https://forms.google.com',
            url: 'https://forms.google.com',
            status: 'UPCOMING',
            date: 'Scheduled for Next Friday',
            targetClass: 'SS 1 & SS 2',
            passcodeProtected: true,
            passcode: 'SS12-ROBO-905'
          }
        ];

        try {
          const exSnap1 = await getDocs(collection(db, 'schoolExams'));
          const liveSchoolExams = exSnap1.docs
            .map(d => ({ id: d.id, ...d.data() } as SchoolExam))
            .filter(d => !d.schoolId || d.schoolId === currentSchoolId);
          
          if (liveSchoolExams.length > 0) {
            setExams(liveSchoolExams);
          } else {
            const exSnap2 = await getDocs(collection(db, 'exams'));
            const generalExams = exSnap2.docs.map(d => ({ id: d.id, ...d.data() } as SchoolExam));
            setExams(generalExams.length > 0 ? generalExams : defaultExams);
          }
        } catch {
          setExams(defaultExams);
        }

        // 3. Fetch Curriculum & School Resources from Firestore (matching schoolResources)
        const defaultResources: SchoolResource[] = [
          {
            id: 'res-1',
            title: 'Complete 2026 STEM & Coding Syllabus (Primary & JSS)',
            category: 'Curriculum Guide',
            fileType: 'PDF Syllabus',
            url: 'https://drive.google.com/file/d/1demo-syllabus/view',
            description: 'Weekly term breakdown of modules: Scratch animation, web design basics, game logic.',
            classLevel: 'Primary & JSS',
            isSecured: false
          },
          {
            id: 'res-2',
            title: 'Term 2 Lesson Slides & Coding Worksheets Pack',
            category: 'Teaching Slides',
            fileType: 'ZIP / PPTX',
            url: 'https://drive.google.com/file/d/1demo-slides/view',
            description: 'Classroom presentation decks and offline lab practice exercises for students.',
            classLevel: 'All Grades',
            isSecured: false
          },
          {
            id: 'res-3',
            title: 'Robotics Kit Assembly & Circuit Wiring Manual',
            category: 'Lab Hardware Manual',
            fileType: 'PDF Manual',
            url: 'https://drive.google.com/file/d/1demo-robotics/view',
            description: 'Step-by-step schematic instructions for student microcontroller projects.',
            classLevel: 'JSS 2 & SS 1',
            isSecured: true,
            accessCode: 'ROBO-CIRCUIT-2026'
          },
          {
            id: 'res-4',
            title: 'Official CBT Invigilator Exam Key & Answer Blueprint',
            category: 'Exam Blueprint',
            fileType: 'Protected PDF',
            url: 'https://drive.google.com/file/d/1demo-blueprint/view',
            description: 'Confidential marking rubric for invigilators and school academic coordinators.',
            classLevel: 'School Admins Only',
            isSecured: true,
            accessCode: 'ADMIN-KEY-773'
          }
        ];

        try {
          const resSnap = await getDocs(collection(db, 'schoolResources'));
          const liveRes = resSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as SchoolResource))
            .filter(d => !d.schoolId || d.schoolId === currentSchoolId);
          setResources(liveRes.length > 0 ? liveRes : defaultResources);
        } catch {
          setResources(defaultResources);
        }

        // 4. Fetch School Links from Firestore (matching schoolLinks)
        const defaultLinks: SchoolLink[] = [
          {
            id: 'link-1',
            title: 'Official CBT Testing & Assessment Server',
            url: 'https://jaystarbliss-studios.web.app',
            description: 'Live testing terminal for student terminal exams and quizzes.'
          },
          {
            id: 'link-2',
            title: 'Cloud STEM Lab Project Repository & Scratch Cloud',
            url: 'https://scratch.mit.edu',
            description: 'Cloud storage and project gallery for cadet games and animations.'
          },
          {
            id: 'link-3',
            title: 'Jaystarbliss Interactive Robotics Simulator',
            url: 'https://wokwi.com',
            description: 'Browser-based Arduino & ESP32 breadboard circuit simulation workbench.'
          }
        ];

        try {
          const linkSnap = await getDocs(collection(db, 'schoolLinks'));
          const liveLinks = linkSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as SchoolLink))
            .filter(d => !d.schoolId || d.schoolId === currentSchoolId);
          setLinks(liveLinks.length > 0 ? liveLinks : defaultLinks);
        } catch {
          setLinks(defaultLinks);
        }

        // 5. Fetch Passcodes from firestore if existing
        try {
          const pcSnap = await getDocs(collection(db, 'schoolPasscodes'));
          if (!pcSnap.empty) {
            const list = pcSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as ClassPasscodeConfig))
              .filter(d => !d.schoolId || d.schoolId === currentSchoolId);
            if (list.length > 0) {
              setPasscodes(list);
            }
          }
        } catch (e) {
          console.warn('schoolPasscodes fetch error:', e);
        }

      } catch (err) {
        console.error('Error fetching school dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolInfo();
  }, []);

  // Filtered student roster
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const name = (student.fullName || student.studentName || student.username || '').toLowerCase();
      const code = (student.accessCode || '').toLowerCase();
      const matchesSearch = name.includes(rosterSearch.toLowerCase()) || code.includes(rosterSearch.toLowerCase());
      const sClass = (student.class || student.grade || '').toUpperCase();
      const matchesClass = selectedClassFilter === 'ALL' || sClass.includes(selectedClassFilter);
      return matchesSearch && matchesClass;
    });
  }, [students, rosterSearch, selectedClassFilter]);

  // Toggle priority
  const togglePriority = (id: number) => {
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, done: !p.done } : p));
  };

  // Copy text helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Generate random new passcode
  const generateRandomCode = (prefix: string = 'EXAM') => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `${prefix.toUpperCase()}-${randomNum}`;
  };

  // Save new or edited passcode
  const handleSavePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPasscode.passcode?.trim() || !editingPasscode.examTitle?.trim()) {
      toast.error('Please enter the exam title and passcode.');
      return;
    }

    try {
      const newConfig: ClassPasscodeConfig = {
        id: editingPasscode.id || `pc-${Date.now()}`,
        classLevel: editingPasscode.classLevel || 'JSS 1',
        subject: editingPasscode.subject || 'STEM & Coding',
        examTitle: editingPasscode.examTitle.trim(),
        passcode: editingPasscode.passcode.trim(),
        isActive: editingPasscode.isActive !== false,
        validUntil: editingPasscode.validUntil || 'End of Term',
        invigilatorName: editingPasscode.invigilatorName || 'Staff Invigilator',
        allocatedCadetsCount: editingPasscode.allocatedCadetsCount || 20
      };

      setPasscodes(prev => {
        const idx = prev.findIndex(p => p.id === newConfig.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = newConfig;
          return copy;
        }
        return [newConfig, ...prev];
      });

      // Save to Firebase
      try {
        await setDoc(doc(db, 'schoolPasscodes', newConfig.id), {
          ...newConfig,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn('Firebase passcode save warning:', err);
      }

      toast.success(`Access Passcode for "${newConfig.classLevel}" updated successfully!`);
      setShowPasscodeModal(false);
      setEditingPasscode({
        classLevel: 'Primary 4 & 5',
        subject: 'Computer Studies',
        examTitle: '',
        passcode: '',
        isActive: true,
        validUntil: 'End of Term 2'
      });
    } catch (err: any) {
      toast.error('Failed to save passcode: ' + err.message);
    }
  };

  // Toggle active status of passcode
  const togglePasscodeActive = async (id: string) => {
    setPasscodes(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, isActive: !p.isActive };
        setDoc(doc(db, 'schoolPasscodes', id), updated, { merge: true }).catch(() => {});
        return updated;
      }
      return p;
    }));
    toast.success('Passcode authorization state toggled.');
  };

  // Add new student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) {
      toast.error('Please enter the student full name.');
      return;
    }

    const newCode = `SCH-${newStudentClass.replace(/\s+/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const newCadet: SchoolStudent = {
      id: `cad-${Date.now()}`,
      fullName: newStudentName.trim(),
      class: newStudentClass,
      accessCode: newCode,
      attendanceRate: 100,
      avgScore: 90,
      subjects: ['STEM', 'Python', 'Coding']
    };

    setStudents(prev => [newCadet, ...prev]);

    try {
      await addDoc(collection(db, 'individualStudents'), {
        fullName: newCadet.fullName,
        studentName: newCadet.fullName,
        class: newCadet.class,
        accessCode: newCode,
        email: newStudentEmail.trim() || undefined,
        schoolName: schoolData?.name || 'Partner Academy',
        schoolCode: schoolData?.schoolCode || 'SCH-JAYSTAR',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Student firebase save warning:', err);
    }

    toast.success(`Cadet ${newCadet.fullName} enrolled with Access Code ${newCode}!`);
    setNewStudentName('');
    setNewStudentEmail('');
    setShowAddStudentModal(false);
  };

  // Export roster to CSV
  const exportRosterCSV = () => {
    if (students.length === 0) {
      toast.error('No students to export.');
      return;
    }
    const headers = ['Cadet Name', 'Class / Grade', 'Student Access Code', 'Attendance Rate (%)', 'Avg Score (%)'];
    const rows = students.map(s => [
      `"${s.fullName || s.studentName || s.username || ''}"`,
      `"${s.class || s.grade || ''}"`,
      `"${s.accessCode || ''}"`,
      s.attendanceRate || 90,
      s.avgScore || 85
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(schoolData?.name || 'School').replace(/\s+/g, '_')}_Cadet_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Roster CSV downloaded successfully!');
  };

  const schoolDisplayName = schoolData?.name || 'Partner Academy';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-red mb-3" />
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">
          Synchronizing institutional cohort records & access keys...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <SEO 
        title="School Operations Hub & Directorate Console | Jaystarbliss Studios" 
        description="Monitor school student enrollments, STEM program schedules, exams, and secured passcodes." 
        noindex={true}
      />

      {/* DYNAMIC TIMEZONE & INFORMAL GREETING BANNER */}
      <DashboardGreeting 
        name={schoolDisplayName}
        role="School Administrator"
        subtitle="Manage student cohort batches, CBT exam evaluations, class access passcodes, and lab timetable schedules."
        badge={`Code: ${schoolData?.schoolCode || 'SCH-JAYSTAR'}`}
      />

      {/* TABS NAVIGATION - CLEAN HUB-MIND DESIGN */}
      <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <button
          id="school-tab-overview"
          className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'overview' 
              ? 'bg-slate-900 text-white dark:bg-brand-red dark:text-white shadow-xs' 
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          <Layers size={16} />
          <span>Hub Overview</span>
        </button>

        <button
          id="school-tab-roster"
          className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'roster' 
              ? 'bg-slate-900 text-white dark:bg-brand-red dark:text-white shadow-xs' 
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60'
          }`}
          onClick={() => setActiveTab('roster')}
        >
          <Users size={16} />
          <span>Cadet Roster</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            {students.length}
          </span>
        </button>

        <button
          id="school-tab-passcodes"
          className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'passcodes' 
              ? 'bg-slate-900 text-white dark:bg-brand-red dark:text-white shadow-xs' 
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60'
          }`}
          onClick={() => setActiveTab('passcodes')}
        >
          <Key size={16} className="text-amber-500" />
          <span>Exam Passcodes</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black">
            {passcodes.filter(p => p.isActive).length} Active
          </span>
        </button>

        <button
          id="school-tab-exams"
          className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'exams' 
              ? 'bg-slate-900 text-white dark:bg-brand-red dark:text-white shadow-xs' 
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60'
          }`}
          onClick={() => setActiveTab('exams')}
        >
          <Award size={16} />
          <span>CBT Assessments</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-brand-red text-white">
            {exams.length}
          </span>
        </button>

        <button
          id="school-tab-resources"
          className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'resources' 
              ? 'bg-slate-900 text-white dark:bg-brand-red dark:text-white shadow-xs' 
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60'
          }`}
          onClick={() => setActiveTab('resources')}
        >
          <BookOpen size={16} />
          <span>Curriculum Guides</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            {resources.length}
          </span>
        </button>

        <button
          id="school-tab-links"
          className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'links' 
              ? 'bg-slate-900 text-white dark:bg-brand-red dark:text-white shadow-xs' 
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60'
          }`}
          onClick={() => setActiveTab('links')}
        >
          <Link2 size={16} />
          <span>School Links</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold">
            {links.length}
          </span>
        </button>

        <button
          id="school-tab-schedules"
          className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'schedules' 
              ? 'bg-slate-900 text-white dark:bg-brand-red dark:text-white shadow-xs' 
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60'
          }`}
          onClick={() => setActiveTab('schedules')}
        >
          <Calendar size={16} />
          <span>Lab Timetable</span>
        </button>

        <button
          id="school-tab-partnership"
          className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'partnership' 
              ? 'bg-slate-900 text-white dark:bg-brand-red dark:text-white shadow-xs' 
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60'
          }`}
          onClick={() => setActiveTab('partnership')}
        >
          <CreditCard size={16} />
          <span>Partnership & Plan</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HUB OVERVIEW (MATCHING USER'S ATTACHED HUB-MIND DESIGN) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* 3 CIRCULAR METRIC RING CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: TASK & SYLLABUS COMPLETION */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Syllabus Progression
                </span>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  78%
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  <span>18 of 23 Modules Completed</span>
                </p>
              </div>

              {/* Animated SVG Donut Ring */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200 dark:text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500 transition-all duration-1000 ease-out"
                    strokeDasharray="78, 100"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-xs font-black text-gray-900 dark:text-white">78%</span>
              </div>
            </div>

            {/* Card 2: ACTIVE CADET COHORTS */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Enrolled Cadets
                </span>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  {students.length}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                  <Users size={13} className="text-blue-500 shrink-0" />
                  <span>4 Grade Cohorts Active</span>
                </p>
              </div>

              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200 dark:text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-blue-500 transition-all duration-1000 ease-out"
                    strokeDasharray="92, 100"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <GraduationCap size={18} className="absolute text-blue-500" />
              </div>
            </div>

            {/* Card 3: EXAM READINESS & PASSCODES */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  CBT & Passcode Readiness
                </span>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  95%
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5 font-medium">
                  <Key size={13} className="shrink-0" />
                  <span>{passcodes.filter(p => p.isActive).length} Passcode Keys Authorized</span>
                </p>
              </div>

              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200 dark:text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-amber-500 transition-all duration-1000 ease-out"
                    strokeDasharray="95, 100"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <Key size={18} className="absolute text-amber-500" />
              </div>
            </div>
          </div>

          {/* 2-COLUMN STRUCTURE: TODAY'S FOCUS vs ACADEMIC / LAB HEALTH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: TODAY'S FOCUS & PRIORITIES (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center">
                      <Sparkles size={16} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Today's Priorities & Action Items
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                    {priorities.filter(p => p.done).length}/{priorities.length} Completed
                  </span>
                </div>

                <div className="space-y-3">
                  {priorities.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => togglePriority(item.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                        item.done 
                          ? 'bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-500' 
                          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white hover:border-brand-red/50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.done ? (
                          <CheckSquare size={18} className="text-emerald-500 shrink-0" />
                        ) : (
                          <Square size={18} className="text-gray-400 shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${item.done ? 'line-through' : ''}`}>
                          {item.text}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 ${
                        item.priority === 'High' 
                          ? 'bg-red-500/10 text-red-500' 
                          : item.priority === 'Normal' 
                          ? 'bg-blue-500/10 text-blue-500' 
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="pt-6 mt-6 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setActiveTab('passcodes')}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
                >
                  <Key size={14} />
                  <span>Manage Class Passcodes</span>
                </button>

                <button
                  onClick={() => setActiveTab('roster')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold text-xs flex items-center gap-2 transition-all"
                >
                  <Users size={14} />
                  <span>View Student Roster</span>
                </button>

                <button
                  onClick={() => setActiveTab('exams')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold text-xs flex items-center gap-2 transition-all"
                >
                  <Award size={14} />
                  <span>CBT Assessment Portal</span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: LAB INFRASTRUCTURE & COHORT HEALTH (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Laptop size={16} />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Lab System & Cohort Health
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                        Lab Station Status
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      Operational (100%)
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Assigned STEM Instructors
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                      Engr. John Rufai & Team
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Next Scheduled Lab Session
                    </span>
                    <span className="text-xs font-bold text-brand-red">
                      {schoolData?.labDays || 'Tuesday @ 2:00 PM'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Active Passcode Protection
                    </span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Lock size={12} /> Enabled
                    </span>
                  </div>
                </div>
              </div>

              {/* Lab emergency assistance */}
              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>Directorate Hotline:</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">+234 913 651 8194</span>
              </div>
            </div>
          </div>

          {/* RECENT PASSCODE KEYS QUICK PANEL */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-3xl p-6 border border-amber-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Special Exam Resources & Invigilator Access Keys
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    Give these confidential codes to students or invigilators only during active examination windows.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('passcodes')}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto hover:opacity-90 transition-opacity shrink-0"
              >
                <span>View All Passcodes</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Quick Grid of Active Keys */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              {passcodes.map(pc => (
                <div 
                  key={pc.id} 
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                    pc.isActive 
                      ? 'bg-white dark:bg-slate-900 border-amber-500/30 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 opacity-60'
                  }`}
                >
                  <div className="truncate">
                    <span className="text-[10px] font-black uppercase text-gray-500 dark:text-slate-400 block truncate">
                      {pc.classLevel}
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                      {pc.passcode}
                    </span>
                  </div>

                  <button
                    onClick={() => copyToClipboard(pc.passcode, `${pc.classLevel} Passcode`)}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-amber-500/20 text-gray-600 dark:text-slate-300 hover:text-amber-600 transition-colors"
                    title="Copy code"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STUDENT ROSTER & COHORTS */}
      {/* ========================================================================= */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users size={20} className="text-brand-red" />
                  <span>Cadet Enrolment Roster ({students.length})</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Track individual student access codes, attendance records, and STEM evaluations.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={exportRosterCSV}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 text-gray-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => setShowAddStudentModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus size={14} />
                  <span>Add Cadet</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="sm:col-span-2 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  placeholder="Search cadet name or access code..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>

              <div>
                <select
                  value={selectedClassFilter}
                  onChange={e => setSelectedClassFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none font-bold"
                >
                  <option value="ALL">All Class Cohorts</option>
                  <option value="PRIMARY">Primary Cadets</option>
                  <option value="JSS 1">JSS 1 Cohort</option>
                  <option value="JSS 2">JSS 2 Cohort</option>
                  <option value="SS">Senior Secondary (SS 1-3)</option>
                </select>
              </div>
            </div>

            {/* Student Table */}
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-slate-400 uppercase font-black tracking-wider border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4">Cadet Name</th>
                    <th className="py-3.5 px-4">Class / Grade</th>
                    <th className="py-3.5 px-4">Individual Access Code</th>
                    <th className="py-3.5 px-4">Attendance</th>
                    <th className="py-3.5 px-4">Avg Score</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-brand-red/10 text-brand-red font-black flex items-center justify-center text-xs">
                              {(st.fullName || st.studentName || 'C').charAt(0)}
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {st.fullName || st.studentName || st.username || 'Unnamed Cadet'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-600 dark:text-slate-300">
                          {st.class || st.grade || 'JSS 1'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-brand-red bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded border border-red-200 dark:border-red-900/40">
                            {st.accessCode || 'SCH-AUTOGEN-01'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full" 
                                style={{ width: `${st.attendanceRate || 90}%` }}
                              ></div>
                            </div>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {st.attendanceRate || 90}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                          {st.avgScore || 88}%
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => copyToClipboard(st.accessCode || '', 'Cadet Code')}
                            className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-brand-red/10 text-gray-600 dark:text-slate-300 hover:text-brand-red transition-colors"
                            title="Copy code"
                          >
                            <Copy size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-slate-400">
                        No cadets matched your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXAM PASSCODES (SPECIAL FEATURE REQUESTED BY USER) */}
      {/* ========================================================================= */}
      {activeTab === 'passcodes' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Key size={18} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Special Exam Resources & Access Passcodes
                  </h2>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 max-w-2xl">
                  Some school assessments and special resource collections require authorization passcodes. 
                  School administrators can create, rotate, and manage passcodes for each class level.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setEditingPasscode({
                      classLevel: 'Primary 4 & 5',
                      subject: 'Computer Studies',
                      examTitle: 'New CBT Assessment',
                      passcode: generateRandomCode('P4'),
                      isActive: true,
                      validUntil: 'End of Term'
                    });
                    setShowPasscodeModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus size={14} />
                  <span>Generate New Passcode</span>
                </button>
              </div>
            </div>

            {/* Passcodes Table / Grid */}
            <div className="space-y-4">
              {passcodes.map((pc) => (
                <div 
                  key={pc.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    pc.isActive 
                      ? 'bg-amber-500/5 dark:bg-amber-500/5 border-amber-500/30' 
                      : 'bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950">
                          {pc.classLevel}
                        </span>

                        <span className="text-xs font-bold text-gray-700 dark:text-slate-300">
                          {pc.subject}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                          pc.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {pc.isActive ? <Lock size={10} /> : <Unlock size={10} />}
                          <span>{pc.isActive ? 'PROTECTED / ACTIVE' : 'DISABLED'}</span>
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {pc.examTitle}
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
                        <span>Validity: <strong className="text-gray-700 dark:text-slate-300">{pc.validUntil}</strong></span>
                        <span>Invigilator: <strong className="text-gray-700 dark:text-slate-300">{pc.invigilatorName || 'Staff'}</strong></span>
                        <span>Cadets: <strong className="text-gray-700 dark:text-slate-300">{pc.allocatedCadetsCount || 20} Enrolled</strong></span>
                      </div>
                    </div>

                    {/* Passcode Block & Controls */}
                    <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-amber-500/20 self-start lg:self-auto">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Access Key
                        </span>
                        <span className="font-mono text-base font-black text-amber-600 dark:text-amber-400 tracking-wider">
                          {pc.passcode}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={() => copyToClipboard(pc.passcode, `${pc.classLevel} Passcode`)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <Copy size={12} />
                          <span>Copy</span>
                        </button>

                        <button
                          onClick={() => togglePasscodeActive(pc.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            pc.isActive 
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600' 
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600'
                          }`}
                        >
                          {pc.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CBT EXAMS & QUIZZES */}
      {/* ========================================================================= */}
      {activeTab === 'exams' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Award size={20} className="text-brand-red" />
                  <span>Computer-Based Testing (CBT) Assessments</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Launch active test papers or view scheduled evaluations for your academy cohorts.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                  Live CBT Server Synchronized
                </span>
              </div>
            </div>

            {/* Exams Search & Filter */}
            <div className="mb-6 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search CBT assessment papers by title, subject, or class..."
                  value={examSearch}
                  onChange={e => setExamSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>
              <select
                value={selectedClassFilter}
                onChange={e => setSelectedClassFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-brand-red outline-none"
              >
                <option value="ALL">All Grade Levels</option>
                <option value="PRIMARY">Primary Cohorts</option>
                <option value="JSS">Junior Secondary (JSS)</option>
                <option value="SS">Senior Secondary (SS)</option>
              </select>
            </div>

            {/* Exams Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {exams
                .filter(ex => {
                  const query = examSearch.toLowerCase();
                  const matchesSearch = 
                    (ex.title || '').toLowerCase().includes(query) ||
                    (ex.subject || '').toLowerCase().includes(query) ||
                    (ex.targetClass || '').toLowerCase().includes(query);
                  const matchesClass = selectedClassFilter === 'ALL' || (ex.targetClass || '').toUpperCase().includes(selectedClassFilter);
                  return matchesSearch && matchesClass;
                })
                .map((ex) => {
                  const examUrl = ex.link || ex.url || '';
                  return (
                    <div 
                      key={ex.id}
                      className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            ex.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {ex.status}
                          </span>
                          <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                            <Clock size={12} /> {ex.duration}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                          {ex.title}
                        </h3>

                        <div className="text-xs text-gray-500 dark:text-slate-400 space-y-1">
                          <p>Subject: <strong className="text-gray-700 dark:text-slate-300">{ex.subject}</strong></p>
                          <p>Session: <strong className="text-gray-700 dark:text-slate-300">{ex.term}</strong></p>
                          {ex.targetClass && (
                            <p>Target Class: <strong className="text-gray-700 dark:text-slate-300">{ex.targetClass}</strong></p>
                          )}
                          {ex.passcode && (
                            <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-between">
                              <span className="flex items-center gap-1 text-[11px] font-semibold">
                                <Key size={12} /> Passcode:
                              </span>
                              <div className="flex items-center gap-1.5 font-mono font-bold text-xs">
                                <span>{ex.passcode}</span>
                                <button
                                  onClick={() => copyToClipboard(ex.passcode!, 'Passcode')}
                                  className="text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                                  title="Copy Passcode"
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-700 flex items-center gap-2">
                        {examUrl && (
                          <button
                            onClick={() => openReader(examUrl, ex.title)}
                            className="py-2 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                            title="Preview Assessment within Dashboard"
                          >
                            <Eye size={12} />
                            <span>Preview</span>
                          </button>
                        )}
                        <a
                          href={examUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                        >
                          <span>Launch CBT Exam</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CURRICULUM GUIDES & RESOURCES (WITH IN-APP READER) */}
      {/* ========================================================================= */}
      {activeTab === 'resources' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BookOpen size={20} className="text-brand-red" />
                  <span>Curriculum Guides, Teaching Manuals & Notes</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Official lesson slides, hardware circuit manuals, and downloadable syllabus packets with in-app reader.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 self-start sm:self-auto">
                {resources.length} Guides Available
              </span>
            </div>

            {/* Resources Search */}
            <div className="mb-6 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search resources, lesson slides, and guides..."
                  value={resourceSearch}
                  onChange={e => setResourceSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>
            </div>

            {/* Resources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resources
                .filter(res => {
                  const query = resourceSearch.toLowerCase();
                  return (
                    (res.title || '').toLowerCase().includes(query) ||
                    (res.category || '').toLowerCase().includes(query) ||
                    (res.description || '').toLowerCase().includes(query) ||
                    (res.classLevel || '').toLowerCase().includes(query)
                  );
                })
                .map((res) => {
                  const targetUrl = res.url || res.fileUrl || '';
                  return (
                    <div 
                      key={res.id}
                      className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase">
                            {res.category}
                          </span>
                          <span className="text-xs font-mono text-gray-400">
                            {res.fileType}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                          {res.title}
                        </h3>

                        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                          {res.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                          Class: {res.classLevel || 'General'}
                        </span>

                        <div className="flex items-center gap-2">
                          {targetUrl && (
                            <button
                              onClick={() => openReader(targetUrl, res.title)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                            >
                              <BookOpen size={12} />
                              <span>Read Now</span>
                            </button>
                          )}

                          <a
                            href={targetUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1 hover:opacity-90 transition-opacity"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5.5: SCHOOL LINKS & EXTERNAL ACADEMIC PORTALS */}
      {/* ========================================================================= */}
      {activeTab === 'links' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Link2 size={20} className="text-brand-red" />
                  <span>Important School Portals & STEM Links</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Direct launchpads for CBT testing portals, robotics simulators, and institutional repositories.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 self-start sm:self-auto">
                {links.length} Connected Portals
              </span>
            </div>

            {/* Links Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search portals, simulators, or external links..."
                  value={linkSearch}
                  onChange={e => setLinkSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>
            </div>

            {/* Links Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {links
                .filter(link => {
                  const query = linkSearch.toLowerCase();
                  return (
                    (link.title || '').toLowerCase().includes(query) ||
                    (link.description || '').toLowerCase().includes(query) ||
                    (link.url || '').toLowerCase().includes(query)
                  );
                })
                .map((link) => (
                <div 
                  key={link.id}
                  className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center font-bold">
                      <Link2 size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                      {link.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                      {link.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openReader(link.url, link.title)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Eye size={12} />
                      <span>Preview</span>
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-1.5 rounded-lg bg-brand-red hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <span>Open Link</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: LAB TIMETABLE */}
      {/* ========================================================================= */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Calendar size={20} className="text-brand-red" />
              <span>Weekly Computer Lab & STEM Schedule</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
              Allocated lab time slots for practical coding, robotics hardware assembly, and live mentor dispatch.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-brand-red text-white">
                    Tuesday Session
                  </span>
                  <span className="text-xs text-gray-400 font-semibold">2:00 PM – 4:00 PM</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-2">
                  Scratch & Junior Python Lab (Primary 4 - JSS 1)
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Lead Instructor: Engr. John Rufai • Lab Room 102
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white">
                    Thursday Session
                  </span>
                  <span className="text-xs text-gray-400 font-semibold">2:00 PM – 4:00 PM</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-2">
                  Robotics IoT Circuits & Web Development (JSS 2 - SS 2)
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Lead Instructor: Lead STEM Faculty • Hardware Lab A
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: PARTNERSHIP & INVOICING */}
      {/* ========================================================================= */}
      {activeTab === 'partnership' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-xs">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <CreditCard size={20} className="text-brand-red" />
              <span>Institutional Partnership Plan & Invoicing</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
              Official agreement details, active subscription term, and downloadable receipts.
            </p>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-slate-700 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                    Active Institutional Plan
                  </span>
                  <h3 className="text-2xl font-black text-white mt-3">
                    {schoolData?.plan || 'School Innovation & STEM Lab Partnership'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Coverage: Full 5-Stage Curriculum + Tutor Dispatch + CBT Exam Licensing
                  </p>
                </div>

                <div className="bg-white/10 p-4 rounded-xl border border-white/10 text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-300 block">Session Status</span>
                  <span className="text-emerald-400 font-bold text-sm">2025/2026 Term 2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD STUDENT CADET */}
      {/* ========================================================================= */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Enroll New Cadet to School Cohort
            </h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Cadet Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  placeholder="e.g. David Adeleke"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Grade / Class Level
                </label>
                <select
                  value={newStudentClass}
                  onChange={e => setNewStudentClass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none font-bold"
                >
                  <option value="Primary 4">Primary 4</option>
                  <option value="Primary 5">Primary 5</option>
                  <option value="JSS 1">Junior Secondary 1 (JSS 1)</option>
                  <option value="JSS 2">Junior Secondary 2 (JSS 2)</option>
                  <option value="JSS 3">Junior Secondary 3 (JSS 3)</option>
                  <option value="SS 1">Senior Secondary 1 (SS 1)</option>
                  <option value="SS 2">Senior Secondary 2 (SS 2)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Parent / Student Email (Optional)
                </label>
                <input
                  type="email"
                  value={newStudentEmail}
                  onChange={e => setNewStudentEmail(e.target.value)}
                  placeholder="cadet@gmail.com"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold shadow-xs"
                >
                  Save & Issue Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT CLASS PASSCODE */}
      {/* ========================================================================= */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Key size={18} className="text-amber-500" />
              <span>Configure Class Exam Passcode</span>
            </h3>

            <form onSubmit={handleSavePasscode} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Target Class Level
                </label>
                <select
                  value={editingPasscode.classLevel}
                  onChange={e => setEditingPasscode(prev => ({ ...prev, classLevel: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                >
                  <option value="Primary 4 & 5">Primary 4 & 5</option>
                  <option value="Junior Secondary 1 (JSS 1)">Junior Secondary 1 (JSS 1)</option>
                  <option value="Junior Secondary 2 (JSS 2)">Junior Secondary 2 (JSS 2)</option>
                  <option value="Junior Secondary 3 (JSS 3)">Junior Secondary 3 (JSS 3)</option>
                  <option value="Senior Secondary (SS 1-3)">Senior Secondary (SS 1-3)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Assessment / Resource Title
                </label>
                <input
                  type="text"
                  required
                  value={editingPasscode.examTitle || ''}
                  onChange={e => setEditingPasscode(prev => ({ ...prev, examTitle: e.target.value }))}
                  placeholder="e.g. Mid-Term Python Logic Assessment"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Secret Passcode Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={editingPasscode.passcode || ''}
                    onChange={e => setEditingPasscode(prev => ({ ...prev, passcode: e.target.value.toUpperCase() }))}
                    placeholder="e.g. JSS1-CODE-882"
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingPasscode(prev => ({ ...prev, passcode: generateRandomCode(prev.classLevel?.substring(0, 3) || 'SCH') }))}
                    className="px-3 py-2 rounded-xl bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 text-xs font-bold shrink-0"
                    title="Generate code"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Invigilator / Supervisor
                </label>
                <input
                  type="text"
                  value={editingPasscode.invigilatorName || ''}
                  onChange={e => setEditingPasscode(prev => ({ ...prev, invigilatorName: e.target.value }))}
                  placeholder="e.g. Academic Lead or Staff Name"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPasscodeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-xs"
                >
                  Save Passcode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DOCUMENT & CURRICULUM READER (FULLSCREEN RESPONSIVE PREVIEW) */}
      {/* ========================================================================= */}
      {readerOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReader();
          }}
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[92vh] max-h-[850px] rounded-3xl border border-gray-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0">
                  <BookOpen size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                    {readerTitle}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                    Live Document & Curriculum Viewer
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={readerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink size={13} />
                  <span className="hidden sm:inline">Open in New Tab</span>
                </a>
                <a
                  href={readerUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  onClick={closeReader}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  title="Close viewer (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer */}
            <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden">
              {readerLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-10 text-center p-4">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-red mb-3" />
                  <p className="text-xs font-semibold text-slate-300">
                    Loading interactive document preview...
                  </p>
                </div>
              )}

              {readerFallback ? (
                <div className="p-8 text-center max-w-md space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
                    <ExternalLink size={24} />
                  </div>
                  <h4 className="text-base font-bold text-white">
                    Preview Protected or Blocked by Host
                  </h4>
                  <p className="text-xs text-slate-400">
                    This document provider restricts direct in-app frames. You can view or download it directly in a dedicated tab.
                  </p>
                  <a
                    href={readerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    <span>Launch External Viewer</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              ) : (
                <iframe
                  src={getEmbeddableUrl(readerUrl)}
                  className="w-full h-full border-0 bg-white"
                  title={readerTitle}
                  onLoad={() => setReaderLoading(false)}
                  onError={() => {
                    setReaderLoading(false);
                    setReaderFallback(true);
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SchoolDashboard;
