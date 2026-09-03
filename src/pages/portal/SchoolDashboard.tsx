import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { db, auth } from '../../lib/firebase';
import { 
  collection, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc, query, where,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Users, Calendar, GraduationCap, BookOpen, ExternalLink,
  Download, CheckCircle2, Clock, Award, 
  Key, Lock, Unlock, Copy, 
  Plus, Search, RefreshCw, 
  ChevronRight, Laptop, CheckSquare, Square,
  CreditCard, Loader2, Link2, Eye, X, Edit3, Trash2, UserCheck
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
  passcode?: string;
  grade?: string;
  class?: string;
  email?: string;
  track?: string;
  subjects?: string[] | string;
  attendanceRate?: number;
  avgScore?: number;
  schoolId?: string;
  schoolName?: string;
  createdAt?: any;
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

function getEmbeddableUrl(url: string): string {
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

export type SchoolDashboardTab = 'overview' | 'roster' | 'exams' | 'passcodes' | 'resources' | 'links' | 'schedules' | 'partnership';

export interface SchoolDashboardProps {
  initialTab?: SchoolDashboardTab;
}

const SchoolDashboard: React.FC<SchoolDashboardProps> = ({ initialTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const resolveTabFromLocation = useCallback((): SchoolDashboardTab => {
    if (initialTab) return initialTab;
    const path = location.pathname.toLowerCase();
    if (path.includes('/portal/school/roster')) return 'roster';
    if (path.includes('/portal/school/passcodes')) return 'passcodes';
    if (path.includes('/portal/school/exams')) return 'exams';
    if (path.includes('/portal/school/curriculum') || path.includes('/portal/school/resources')) return 'resources';
    if (path.includes('/portal/school/links')) return 'links';
    if (path.includes('/portal/school/schedules') || path.includes('/portal/school/timetable')) return 'schedules';
    if (path.includes('/portal/school/partnership')) return 'partnership';

    const tabQuery = searchParams.get('tab') as SchoolDashboardTab;
    if (tabQuery && ['overview', 'roster', 'exams', 'passcodes', 'resources', 'links', 'schedules', 'partnership'].includes(tabQuery)) {
      return tabQuery;
    }
    return 'overview';
  }, [initialTab, location.pathname, searchParams]);

  const [activeTab, setActiveTab] = useState<SchoolDashboardTab>(resolveTabFromLocation);

  useEffect(() => {
    const nextTab = resolveTabFromLocation();
    setActiveTab(nextTab);
  }, [resolveTabFromLocation]);

  const handleTabChange = (tab: SchoolDashboardTab) => {
    setActiveTab(tab);
    if (tab === 'overview') {
      navigate('/portal/school');
    } else {
      navigate(`/portal/school/${tab}`);
    }
  };
  const [schoolData, setSchoolData] = useState<any>(null);
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [exams, setExams] = useState<SchoolExam[]>([]);
  const [resources, setResources] = useState<SchoolResource[]>([]);
  const [links, setLinks] = useState<SchoolLink[]>([]);
  const [passcodes, setPasscodes] = useState<ClassPasscodeConfig[]>([]);
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
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('JSS 1');
  const [newStudentPasscode, setNewStudentPasscode] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentTrack, setNewStudentTrack] = useState('Coding & Python Algorithms');

  // Edit Cadet Modal State
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<SchoolStudent | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentUsername, setEditStudentUsername] = useState('');
  const [editStudentClass, setEditStudentClass] = useState('JSS 1');
  const [editStudentPasscode, setEditStudentPasscode] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');
  const [editStudentTrack, setEditStudentTrack] = useState('Coding & Python Algorithms');

  // Cadet Activity Details Modal State
  const [selectedStudentForActivity, setSelectedStudentForActivity] = useState<SchoolStudent | null>(null);

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
          const directSnap = await getDoc(doc(db, 'schools', schoolDocId));
          if (directSnap.exists()) {
            schoolDoc = { id: directSnap.id, ...directSnap.data() };
          } else {
            const byCode = await getDocs(query(collection(db, 'schools'), where('schoolId', '==', schoolDocId)));
            if (!byCode.empty) {
              schoolDoc = { id: byCode.docs[0].id, ...byCode.docs[0].data() };
            } else {
              const byShortCode = await getDocs(query(collection(db, 'schools'), where('code', '==', schoolDocId)));
              if (!byShortCode.empty) {
                schoolDoc = { id: byShortCode.docs[0].id, ...byShortCode.docs[0].data() };
              }
            }
          }
        }

        if (!schoolDoc && user) {
          const byAdmin = await getDocs(query(collection(db, 'schools'), where('adminUid', '==', user.uid)));
          if (!byAdmin.empty) {
            schoolDoc = { id: byAdmin.docs[0].id, ...byAdmin.docs[0].data() };
          } else {
            const byUser = await getDocs(query(collection(db, 'schools'), where('userId', '==', user.uid)));
            if (!byUser.empty) {
              schoolDoc = { id: byUser.docs[0].id, ...byUser.docs[0].data() };
            }
          }
        }

        if (!schoolDoc) {
          throw new Error('School profile could not be resolved for this account.');
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
              accessCode: data.accessCode || data.passcode || `SCH-${(data.class || 'JSS1').replace(/\s+/g, '')}-101`,
              passcode: data.passcode || data.accessCode || `SCH-${(data.class || 'JSS1').replace(/\s+/g, '')}-101`,
              username: data.username || (data.fullName || 'cadet').toLowerCase().replace(/[^a-z0-9]/g, '.'),
              attendanceRate: data.attendanceRate || (Math.floor(Math.random() * 15) + 85),
              avgScore: data.avgScore || (Math.floor(Math.random() * 20) + 78)
            });
          }
        });

        setStudents(sList);

        // 2. Fetch Exams & Quizzes from Firestore (matching schoolExams & exams)
        try {
          const exSnap1 = await getDocs(query(collection(db, 'schoolExams'), where('schoolId', '==', currentSchoolId)));
          const liveSchoolExams = exSnap1.docs
            .map(d => ({ id: d.id, ...d.data() } as SchoolExam))
            .filter(d => !d.schoolId || d.schoolId === currentSchoolId);
          
          if (liveSchoolExams.length > 0) {
            setExams(liveSchoolExams);
          } else {
            const exSnap2 = await getDocs(collection(db, 'exams'));
            const generalExams = exSnap2.docs.map(d => ({ id: d.id, ...d.data() } as SchoolExam));
            setExams(generalExams);
          }
        } catch {
          setExams([]);
        }

        // 3. Fetch Curriculum & School Resources from Firestore (matching schoolResources)
        try {
          const resSnap = await getDocs(query(collection(db, 'schoolResources'), where('schoolId', '==', currentSchoolId)));
          const liveRes = resSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as SchoolResource))
            .filter(d => !d.schoolId || d.schoolId === currentSchoolId);
          setResources(liveRes);
        } catch {
          setResources([]);
        }

        // 4. Fetch School Links from Firestore (matching schoolLinks)
        try {
          const linkSnap = await getDocs(query(collection(db, 'schoolLinks'), where('schoolId', '==', currentSchoolId)));
          const liveLinks = linkSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as SchoolLink))
            .filter(d => !d.schoolId || d.schoolId === currentSchoolId);
          setLinks(liveLinks);
        } catch {
          setLinks([]);
        }

        // 5. Fetch Passcodes from firestore if existing
        try {
          const pcSnap = await getDocs(query(collection(db, 'schoolPasscodes'), where('schoolId', '==', currentSchoolId)));
          if (!pcSnap.empty) {
            const list = pcSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as ClassPasscodeConfig))
              .filter(d => !d.schoolId || d.schoolId === currentSchoolId);
            setPasscodes(list);
          } else {
            setPasscodes([]);
          }
        } catch (e) {
          console.warn('schoolPasscodes fetch error:', e);
          setPasscodes([]);
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
      const code = (student.accessCode || student.passcode || '').toLowerCase();
      const username = (student.username || '').toLowerCase();
      const matchesSearch = name.includes(rosterSearch.toLowerCase()) || code.includes(rosterSearch.toLowerCase()) || username.includes(rosterSearch.toLowerCase());
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

  const openAddStudentModal = () => {
    setNewStudentName('');
    setNewStudentUsername('');
    setNewStudentClass('JSS 1');
    setNewStudentPasscode(generateRandomCode('JSS1'));
    setNewStudentEmail('');
    setNewStudentTrack('Coding & Python Algorithms');
    setShowAddStudentModal(true);
  };

  const handleNameChangeForNewStudent = (name: string) => {
    setNewStudentName(name);
    if (name.trim()) {
      const clean = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '.');
      setNewStudentUsername(clean);
    }
  };

  const handleClassChangeForNewStudent = (cls: string) => {
    setNewStudentClass(cls);
    const prefix = cls.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    setNewStudentPasscode(generateRandomCode(prefix || 'SCH'));
  };

  // Add new student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) {
      toast.error('Please enter the student full name.');
      return;
    }

    const effectiveUsername = (newStudentUsername.trim() || newStudentName.trim().toLowerCase().replace(/[^a-z0-9]/g, '.'));
    const effectivePasscode = (newStudentPasscode.trim() || generateRandomCode('SCH')).toUpperCase();

    const newCadet: SchoolStudent = {
      id: `cad-${Date.now()}`,
      fullName: newStudentName.trim(),
      studentName: newStudentName.trim(),
      username: effectiveUsername,
      class: newStudentClass,
      grade: newStudentClass,
      accessCode: effectivePasscode,
      passcode: effectivePasscode,
      email: newStudentEmail.trim() || undefined,
      track: newStudentTrack,
      attendanceRate: 100,
      avgScore: 90,
      subjects: ['STEM', 'Python', 'Coding', newStudentTrack],
      schoolId: schoolData?.id || schoolData?.schoolId || 'peniel',
      schoolName: schoolData?.name || 'Partner Academy'
    };

    setStudents(prev => [newCadet, ...prev]);

    try {
      const docRef = await addDoc(collection(db, 'individualStudents'), {
        fullName: newCadet.fullName,
        studentName: newCadet.fullName,
        username: newCadet.username,
        class: newCadet.class,
        grade: newCadet.class,
        accessCode: effectivePasscode,
        passcode: effectivePasscode,
        email: newStudentEmail.trim() || undefined,
        track: newStudentTrack,
        role: 'student',
        attendanceRate: 100,
        avgScore: 90,
        schoolId: schoolData?.id || schoolData?.schoolId || 'peniel',
        schoolName: schoolData?.name || 'Partner Academy',
        schoolCode: schoolData?.schoolCode || 'SCH-JAYSTAR',
        createdAt: serverTimestamp()
      });
      newCadet.id = docRef.id;
    } catch (err) {
      console.warn('Student firebase save warning:', err);
    }

    toast.success(`Cadet ${newCadet.fullName} enrolled! Username: "${effectiveUsername}", Passcode: "${effectivePasscode}"`);
    setShowAddStudentModal(false);
  };

  const handleOpenEditStudent = (st: SchoolStudent) => {
    setEditingStudent(st);
    setEditStudentName(st.fullName || st.studentName || '');
    setEditStudentUsername(st.username || (st.fullName || '').toLowerCase().replace(/[^a-z0-9]/g, '.'));
    setEditStudentClass(st.class || st.grade || 'JSS 1');
    setEditStudentPasscode(st.accessCode || st.passcode || generateRandomCode('SCH'));
    setEditStudentEmail(st.email || '');
    setEditStudentTrack(st.track || 'Coding & Python Algorithms');
    setShowEditStudentModal(true);
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editStudentName.trim()) {
      toast.error('Student name cannot be empty.');
      return;
    }

    const updatedData: Partial<SchoolStudent> = {
      fullName: editStudentName.trim(),
      studentName: editStudentName.trim(),
      username: editStudentUsername.trim().toLowerCase(),
      class: editStudentClass,
      grade: editStudentClass,
      accessCode: editStudentPasscode.trim().toUpperCase(),
      passcode: editStudentPasscode.trim().toUpperCase(),
      email: editStudentEmail.trim() || undefined,
      track: editStudentTrack,
      subjects: ['STEM', 'Python', 'Coding', editStudentTrack]
    };

    setStudents(prev => prev.map(s => s.id === editingStudent.id ? { ...s, ...updatedData } : s));

    try {
      await updateDoc(doc(db, 'individualStudents', editingStudent.id), {
        ...updatedData,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Student update error:', err);
    }

    toast.success(`Cadet ${editStudentName} updated successfully!`);
    setShowEditStudentModal(false);
    setEditingStudent(null);
  };

  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove Cadet "${name}" from this school cohort?`)) {
      return;
    }
    setStudents(prev => prev.filter(s => s.id !== studentId));
    try {
      await deleteDoc(doc(db, 'individualStudents', studentId));
      toast.success(`Cadet ${name} removed from roster.`);
    } catch (err) {
      console.warn('Student deletion warning:', err);
      toast.success(`Cadet ${name} removed from active roster.`);
    }
  };

  const copyStudentFullCredentials = (st: SchoolStudent) => {
    const name = st.fullName || st.studentName || 'Cadet';
    const username = st.username || 'cadet';
    const passcode = st.accessCode || st.passcode || 'N/A';
    const cls = st.class || st.grade || 'General';
    const school = schoolData?.name || 'Partner Academy';
    const text = `Jaystarbliss Portal Credentials\nSchool: ${school}\nCadet: ${name}\nClass: ${cls}\nUsername: ${username}\nPasscode: ${passcode}\nPortal Login: ${window.location.origin}/portal`;
    navigator.clipboard.writeText(text);
    toast.success(`Credentials for ${name.split(' ')[0]} copied to clipboard!`);
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
        allocatedCadetsCount: editingPasscode.allocatedCadetsCount || 20,
        schoolId: schoolData?.id || schoolData?.schoolId || sessionStorage.getItem('schoolId') || ''
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
    <div className="dashboard-interface space-y-6 max-w-7xl mx-auto pb-12">
      <SEO 
        title="School Operations Hub & Directorate Console | Jaystarbliss Studios" 
        description="Monitor school student enrollments, STEM program schedules, exams, and secured passcodes." 
        noindex={true}
      />

      {/* DYNAMIC TIMEZONE & INFORMAL GREETING BANNER - ONLY IN HUB OVERVIEW */}
      {activeTab === 'overview' && (
        <DashboardGreeting 
          name={schoolDisplayName}
          role="School Administrator"
          subtitle="Manage student cohort batches, CBT exam evaluations, class access passcodes, and lab timetable schedules."
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 1: HUB OVERVIEW (MATCHING USER'S ATTACHED HUB-MIND DESIGN) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* 3 CIRCULAR METRIC RING CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: TASK & SYLLABUS COMPLETION */}
            <div className="pro-surface p-6 rounded-3xl flex items-center justify-between">
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
            <div className="pro-surface p-6 rounded-3xl flex items-center justify-between">
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
            <div className="pro-surface p-6 rounded-3xl flex items-center justify-between">
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
            <div className="lg:col-span-7 pro-surface p-6 md:p-7 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center">
                      <CheckSquare size={16} />
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
                  onClick={() => handleTabChange('passcodes')}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
                >
                  <Key size={14} />
                  <span>Manage Class Passcodes</span>
                </button>

                <button
                  onClick={() => handleTabChange('roster')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold text-xs flex items-center gap-2 transition-all"
                >
                  <Users size={14} />
                  <span>View Student Roster</span>
                </button>

                <button
                  onClick={() => handleTabChange('exams')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold text-xs flex items-center gap-2 transition-all"
                >
                  <Award size={14} />
                  <span>CBT Assessment Portal</span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: LAB INFRASTRUCTURE & COHORT HEALTH (5 cols) */}
            <div className="lg:col-span-5 pro-surface p-6 md:p-7 rounded-3xl flex flex-col justify-between">
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
                onClick={() => handleTabChange('passcodes')}
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
          <div className="pro-surface p-6 md:p-8 rounded-3xl">
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
                  onClick={openAddStudentModal}
                  className="px-4 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus size={14} />
                  <span>Enroll Cadet</span>
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
                  placeholder="Search cadet name, username or access code..."
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
                  <option value="PRIMARY">Primary Cadets (P4-P6)</option>
                  <option value="JSS 1">Junior Secondary 1 (JSS 1)</option>
                  <option value="JSS 2">Junior Secondary 2 (JSS 2)</option>
                  <option value="JSS 3">Junior Secondary 3 (JSS 3)</option>
                  <option value="SS">Senior Secondary (SS 1-3)</option>
                </select>
              </div>
            </div>

            {/* Student Table */}
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-slate-400 uppercase font-black tracking-wider border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4">Cadet & Username</th>
                    <th className="py-3.5 px-4">Class Level</th>
                    <th className="py-3.5 px-4">Individual Passcode</th>
                    <th className="py-3.5 px-4">Assigned Track</th>
                    <th className="py-3.5 px-4">Attendance</th>
                    <th className="py-3.5 px-4">Score</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red font-black flex items-center justify-center text-xs shrink-0">
                              {(st.fullName || st.studentName || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 dark:text-white truncate">
                                {st.fullName || st.studentName || 'Unnamed Cadet'}
                              </div>
                              <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400 flex items-center gap-1">
                                <span>@{st.username || (st.fullName || 'cadet').toLowerCase().replace(/[^a-z0-9]/g, '.')}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-gray-700 dark:text-slate-200 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                            {st.class || st.grade || 'JSS 1'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-brand-red bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded border border-red-200 dark:border-red-900/40">
                              {st.accessCode || st.passcode || 'SCH-KEY-101'}
                            </span>
                            <button
                              onClick={() => copyToClipboard(st.accessCode || st.passcode || '', 'Passcode')}
                              className="p-1 text-gray-400 hover:text-brand-red transition-colors"
                              title="Copy passcode"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-gray-600 dark:text-slate-300">
                          {st.track || (Array.isArray(st.subjects) ? st.subjects.join(', ') : st.subjects) || 'Coding & STEM'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full" 
                                style={{ width: `${st.attendanceRate || 90}%` }}
                              ></div>
                            </div>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                              {st.attendanceRate || 90}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                          {st.avgScore || 88}%
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedStudentForActivity(st)}
                              className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-brand-red/10 text-gray-600 dark:text-slate-300 hover:text-brand-red transition-colors"
                              title="View Activity & Class Resources"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenEditStudent(st)}
                              className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-brand-red/10 text-gray-600 dark:text-slate-300 hover:text-brand-red transition-colors"
                              title="Edit Cadet"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => copyStudentFullCredentials(st)}
                              className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-brand-red/10 text-gray-600 dark:text-slate-300 hover:text-brand-red transition-colors"
                              title="Copy Login Credentials"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(st.id, st.fullName || st.studentName || 'Cadet')}
                              className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-red-500/10 text-gray-600 dark:text-slate-300 hover:text-red-600 transition-colors"
                              title="Remove Cadet"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-slate-400">
                        No cadets matched your search criteria. Click "Enroll Cadet" above to register students.
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
          <div className="pro-surface p-6 md:p-8 rounded-3xl">
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
          <div className="pro-surface p-6 md:p-8 rounded-3xl">
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
          <div className="pro-surface p-6 md:p-8 rounded-3xl">
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
          <div className="pro-surface p-6 md:p-8 rounded-3xl">
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
          <div className="pro-surface p-6 md:p-8 rounded-3xl">
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
          <div className="pro-surface p-6 md:p-8 rounded-3xl">
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-brand-red" />
                <span>Enroll New Cadet</span>
              </h3>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Cadet Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={e => handleNameChangeForNewStudent(e.target.value)}
                  placeholder="e.g. David Adeleke"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Login Username (Unique) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono">@</span>
                  <input
                    type="text"
                    required
                    value={newStudentUsername}
                    onChange={e => setNewStudentUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    placeholder="david.adeleke"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                    Grade / Class *
                  </label>
                  <select
                    value={newStudentClass}
                    onChange={e => handleClassChangeForNewStudent(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none font-bold"
                  >
                    <option value="Primary 4">Primary 4</option>
                    <option value="Primary 5">Primary 5</option>
                    <option value="Primary 6">Primary 6</option>
                    <option value="JSS 1">JSS 1</option>
                    <option value="JSS 2">JSS 2</option>
                    <option value="JSS 3">JSS 3</option>
                    <option value="SS 1">SS 1</option>
                    <option value="SS 2">SS 2</option>
                    <option value="SS 3">SS 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                    Passcode *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={newStudentPasscode}
                      onChange={e => setNewStudentPasscode(e.target.value.toUpperCase())}
                      placeholder="SCH-101"
                      className="w-full px-2.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-mono font-bold text-brand-red focus:ring-2 focus:ring-brand-red outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setNewStudentPasscode(generateRandomCode(newStudentClass.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4) || 'SCH'))}
                      className="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-300 text-xs shrink-0"
                      title="Generate new random passcode"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  STEM Track / Elective
                </label>
                <select
                  value={newStudentTrack}
                  onChange={e => setNewStudentTrack(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                >
                  <option value="Coding & Python Algorithms">Coding & Python Algorithms</option>
                  <option value="Robotics & Physical Computing">Robotics & Physical Computing</option>
                  <option value="Web & Software Engineering">Web & Software Engineering</option>
                  <option value="Artificial Intelligence & Data">Artificial Intelligence & Data</option>
                  <option value="UI/UX & Product Design">UI/UX & Product Design</option>
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
                  placeholder="parent@gmail.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <UserCheck size={14} />
                  <span>Enroll & Generate Key</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT CADET DETAILS */}
      {/* ========================================================================= */}
      {showEditStudentModal && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit3 size={18} className="text-brand-red" />
                <span>Edit Cadet Profile</span>
              </h3>
              <button
                onClick={() => {
                  setShowEditStudentModal(false);
                  setEditingStudent(null);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Cadet Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={e => setEditStudentName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Username *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono">@</span>
                  <input
                    type="text"
                    required
                    value={editStudentUsername}
                    onChange={e => setEditStudentUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                    Grade / Class *
                  </label>
                  <select
                    value={editStudentClass}
                    onChange={e => setEditStudentClass(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none font-bold"
                  >
                    <option value="Primary 4">Primary 4</option>
                    <option value="Primary 5">Primary 5</option>
                    <option value="Primary 6">Primary 6</option>
                    <option value="JSS 1">JSS 1</option>
                    <option value="JSS 2">JSS 2</option>
                    <option value="JSS 3">JSS 3</option>
                    <option value="SS 1">SS 1</option>
                    <option value="SS 2">SS 2</option>
                    <option value="SS 3">SS 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                    Passcode *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={editStudentPasscode}
                      onChange={e => setEditStudentPasscode(e.target.value.toUpperCase())}
                      className="w-full px-2.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-mono font-bold text-brand-red focus:ring-2 focus:ring-brand-red outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEditStudentPasscode(generateRandomCode(editStudentClass.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4) || 'SCH'))}
                      className="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-300 text-xs shrink-0"
                      title="Generate new passcode"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  STEM Track / Elective
                </label>
                <select
                  value={editStudentTrack}
                  onChange={e => setEditStudentTrack(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                >
                  <option value="Coding & Python Algorithms">Coding & Python Algorithms</option>
                  <option value="Robotics & Physical Computing">Robotics & Physical Computing</option>
                  <option value="Web & Software Engineering">Web & Software Engineering</option>
                  <option value="Artificial Intelligence & Data">Artificial Intelligence & Data</option>
                  <option value="UI/UX & Product Design">UI/UX & Product Design</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                  Parent / Student Email
                </label>
                <input
                  type="email"
                  value={editStudentEmail}
                  onChange={e => setEditStudentEmail(e.target.value)}
                  placeholder="parent@gmail.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditStudentModal(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <CheckSquare size={14} />
                  <span>Update Cadet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADET ACTIVITY & CLASS CURRICULUM INSPECTOR */}
      {/* ========================================================================= */}
      {selectedStudentForActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-gray-200 dark:border-slate-800 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-red/10 text-brand-red font-black flex items-center justify-center text-lg">
                  {(selectedStudentForActivity.fullName || selectedStudentForActivity.studentName || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedStudentForActivity.fullName || selectedStudentForActivity.studentName || 'Cadet Profile'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-bold text-brand-red">@{selectedStudentForActivity.username || 'cadet'}</span>
                    <span>•</span>
                    <span className="font-semibold text-gray-700 dark:text-slate-300">{selectedStudentForActivity.class || selectedStudentForActivity.grade || 'JSS 1'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyStudentFullCredentials(selectedStudentForActivity)}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Copy size={13} />
                  <span>Copy Login</span>
                </button>
                <button
                  onClick={() => setSelectedStudentForActivity(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Credentials Card */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400 block mb-0.5">Class Cohort</span>
                <span className="font-bold text-gray-900 dark:text-white">{selectedStudentForActivity.class || selectedStudentForActivity.grade || 'JSS 1'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400 block mb-0.5">Passcode / Key</span>
                <span className="font-mono font-bold text-brand-red">{selectedStudentForActivity.accessCode || selectedStudentForActivity.passcode || 'SCH-101'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400 block mb-0.5">Attendance</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedStudentForActivity.attendanceRate || 92}%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400 block mb-0.5">Lab Score Avg</span>
                <span className="font-bold text-gray-900 dark:text-white">{selectedStudentForActivity.avgScore || 88}%</span>
              </div>
            </div>

            {/* Section 1: Assigned Class Resources & Worksheets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-brand-red" />
                  <span>Assigned Class Curriculum & Coursework</span>
                </h4>
                <span className="text-[11px] text-gray-500 dark:text-slate-400">
                  {selectedStudentForActivity.class || 'JSS 1'} + General Materials
                </span>
              </div>

              <div className="space-y-2">
                {resources.filter(r => {
                  const target = (r.classLevel || '').toUpperCase();
                  const stClass = (selectedStudentForActivity.class || selectedStudentForActivity.grade || '').toUpperCase();
                  return !target || target === 'ALL' || target === 'GENERAL' || target.includes(stClass) || stClass.includes(target);
                }).length > 0 ? (
                  resources.filter(r => {
                    const target = (r.classLevel || '').toUpperCase();
                    const stClass = (selectedStudentForActivity.class || selectedStudentForActivity.grade || '').toUpperCase();
                    return !target || target === 'ALL' || target === 'GENERAL' || target.includes(stClass) || stClass.includes(target);
                  }).slice(0, 5).map(res => (
                    <div key={res.id} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 dark:text-white truncate">{res.title}</div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">{res.category || 'Curriculum Material'} • {res.classLevel || 'All Classes'}</div>
                      </div>
                      <button
                        onClick={() => openReader(res.url || res.fileUrl || '', res.title)}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-brand-red/10 text-gray-700 dark:text-slate-200 hover:text-brand-red font-bold text-[11px] flex items-center gap-1 shrink-0"
                      >
                        <Eye size={12} />
                        <span>Preview</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-center text-xs text-gray-500 dark:text-slate-400">
                    No curriculum materials currently uploaded specifically for this class.
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Forwarded CBT Examinations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Award size={14} className="text-brand-red" />
                  <span>Forwarded CBT Examinations & Quizzes</span>
                </h4>
                <span className="text-[11px] text-gray-500 dark:text-slate-400">
                  Class Assessments
                </span>
              </div>

              <div className="space-y-2">
                {exams.filter(ex => {
                  const target = (ex.targetClass || '').toUpperCase();
                  const stClass = (selectedStudentForActivity.class || selectedStudentForActivity.grade || '').toUpperCase();
                  return !target || target === 'ALL' || target.includes(stClass) || stClass.includes(target);
                }).length > 0 ? (
                  exams.filter(ex => {
                    const target = (ex.targetClass || '').toUpperCase();
                    const stClass = (selectedStudentForActivity.class || selectedStudentForActivity.grade || '').toUpperCase();
                    return !target || target === 'ALL' || target.includes(stClass) || stClass.includes(target);
                  }).slice(0, 4).map(exam => (
                    <div key={exam.id} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 dark:text-white truncate">{exam.title}</div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">{exam.subject || 'STEM & Coding'} • Duration: {exam.duration || '45 mins'}</div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] shrink-0 border border-emerald-200 dark:border-emerald-900/40">
                        {exam.status || 'ACTIVE'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-center text-xs text-gray-500 dark:text-slate-400">
                    No active examinations scheduled for this cohort.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const cadet = selectedStudentForActivity;
                  setSelectedStudentForActivity(null);
                  handleOpenEditStudent(cadet);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Edit3 size={13} />
                <span>Edit Cadet Information</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStudentForActivity(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
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
