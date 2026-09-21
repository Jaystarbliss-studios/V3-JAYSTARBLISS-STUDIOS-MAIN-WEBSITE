import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { 
  collection, deleteDoc, doc, getDocs, setDoc, addDoc, updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { 
  Users, UserPlus, Search, KeyRound, Copy, CheckCircle2, 
  Trash2, Send, RefreshCw, ShieldCheck, X, School, 
  GraduationCap, UserCheck, Download, Link as LinkIcon,
  Filter, ChevronDown
} from 'lucide-react';

export interface UnifiedStudent {
  id: string;
  docSource: 'individualStudents' | 'students' | 'users';
  fullName: string;
  username: string;
  email: string;
  class: string;
  grade: string;
  track: string;
  subjects: string;
  schoolId: string;
  schoolName: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  accountStatus: string;
  accessCode: string;
  accessCodeHash?: string;
  portalAccessEnabled: boolean;
  studentType: 'personal' | 'parent' | 'school';
  createdAt?: any;
  firebaseUid?: string;
}

interface Dispatch {
  id: string;
  collectionName: string;
  kind: 'resource' | 'link';
  studentId?: string;
  title?: string;
  description?: string;
  url?: string;
  fileUrl?: string;
  timestamp?: any;
}

interface Credentials {
  username: string;
  accessCode: string;
  portal: string;
  fullName: string;
  email?: string;
}

const STATIC_SCHOOLS = [
  { id: 'peniel', name: 'Peniel Lily Montessori School' },
  { id: 'southgold', name: 'South Gold Montessori School' },
  { id: 'sapphire', name: 'Sapphire Explorer Montessori School' },
  { id: 'easystars', name: 'Easy Stars Early Years Academy' },
  { id: 'christycaleb', name: 'Christy Caleb International School' },
  { id: 'royalbreed', name: 'Royal Breed Academy' },
];

const AdminStudents: React.FC = () => {
  const { toast } = useToast();
  
  // Data State
  const [students, setStudents] = useState<UnifiedStudent[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>(STATIC_SCHOOLS);
  const [tutors, setTutors] = useState<{ id: string; name: string; email: string }[]>([]);
  const [parents, setParents] = useState<{ id: string; name: string; email: string; phone?: string }[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'personal' | 'parent' | 'school'>('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tutorFilter, setTutorFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isFilterOpen]);

  // Modals & Drawers
  const [showCreate, setShowCreate] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [assigningTutorStudent, setAssigningTutorStudent] = useState<UnifiedStudent | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState('');

  // Forms
  const [form, setForm] = useState({
    studentType: 'personal' as 'personal' | 'parent' | 'school',
    fullName: '',
    username: '',
    email: '',
    className: '',
    track: 'STEM & Robotics Foundation',
    subjects: 'Coding, Mathematics, Robotics',
    schoolId: '',
    parentId: '',
    tutorId: '',
    accessCode: ''
  });

  const [resourceForm, setResourceForm] = useState({
    studentId: '',
    type: 'resource' as 'resource' | 'link',
    title: '',
    url: '',
    description: ''
  });
  const [sendingResource, setSendingResource] = useState(false);

  // Get Auth Token for backend helper calls
  const getAuthToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Your administrator session has expired.');
    return await user.getIdToken();
  }, []);

  // Main Unified Student Data Loader
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Your administrator session has expired.');
      const token = await user.getIdToken();

      // The admin directory is resolved server-side so every student source is
      // authoritative and Firestore client rules cannot silently hide a collection.
      const response = await fetch('/.netlify/functions/admin-students-directory', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load the complete student directory.');

      setStudents(Array.isArray(result.students) ? result.students : []);

      const [schoolsSnap, usersSnap, resSnap, linkSnap] = await Promise.all([
        getDocs(collection(db, 'schools')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'users')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'personalResources')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'personalLinks')).catch(() => ({ docs: [] })),
      ]);

      const schoolMap = new Map<string, string>();
      STATIC_SCHOOLS.forEach(s => schoolMap.set(s.id, s.name));
      const loadedSchools = [...STATIC_SCHOOLS];
      schoolsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const name = data.name || data.schoolName || d.id;
        schoolMap.set(d.id, name);
        if (!loadedSchools.some(s => s.id === d.id)) loadedSchools.push({ id: d.id, name });
      });
      setSchools(loadedSchools);

      const loadedTutors: { id: string; name: string; email: string }[] = [];
      const loadedParents: { id: string; name: string; email: string; phone?: string }[] = [];
      usersSnap.docs.forEach((d: any) => {
        const u = d.data();
        const role = String(u.role || '').toUpperCase();
        const name = u.name || u.fullName || u.displayName || u.email || 'User';
        if (['STAFF','TUTOR','INSTRUCTOR','TEACHER'].includes(role)) loadedTutors.push({ id: d.id, name, email: u.email || '' });
        if (['PARENT','GUARDIAN'].includes(role)) loadedParents.push({ id: d.id, name, email: u.email || '', phone: u.phone || u.phoneNumber });
      });
      setTutors(loadedTutors);
      setParents(loadedParents);

      const mergedDispatches: Dispatch[] = [];
      resSnap.docs.forEach((item: any) => mergedDispatches.push({ id: item.id, collectionName: 'personalResources', kind: 'resource', ...item.data() }));
      linkSnap.docs.forEach((item: any) => mergedDispatches.push({ id: item.id, collectionName: 'personalLinks', kind: 'link', ...item.data() }));
      mergedDispatches.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
      setDispatches(mergedDispatches);
    } catch (error) {
      console.error('Unified student operations load error:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to synchronize student directory.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  // Multi-Criteria Filtering
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Type Filter
      if (typeFilter !== 'all' && student.studentType !== typeFilter) {
        return false;
      }

      // School Filter
      if (schoolFilter !== 'all') {
        if (student.schoolId !== schoolFilter) return false;
      }

      // Status Filter
      if (statusFilter !== 'all') {
        const isSuspended = ['SUSPENDED', 'BANNED', 'DISABLED'].includes(student.accountStatus.toUpperCase());
        if (statusFilter === 'active' && isSuspended) return false;
        if (statusFilter === 'suspended' && !isSuspended) return false;
      }

      // Tutor Filter
      if (tutorFilter !== 'all') {
        if (tutorFilter === 'unassigned' && student.tutorId) return false;
        if (tutorFilter === 'assigned' && !student.tutorId) return false;
        if (tutorFilter !== 'assigned' && tutorFilter !== 'unassigned' && student.tutorId !== tutorFilter) return false;
      }

      // Search Query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches = [
          student.fullName,
          student.username,
          student.email,
          student.class,
          student.grade,
          student.track,
          student.schoolName,
          student.parentName,
          student.parentEmail,
          student.tutorName,
          student.subjects
        ].some(val => String(val || '').toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [students, typeFilter, schoolFilter, statusFilter, tutorFilter, search]);

  // Statistics Counts
  const stats = useMemo(() => {
    return {
      total: students.length,
      personal: students.filter(s => s.studentType === 'personal').length,
      parent: students.filter(s => s.studentType === 'parent').length,
      school: students.filter(s => s.studentType === 'school').length,
      active: students.filter(s => !['SUSPENDED', 'BANNED', 'DISABLED'].includes(s.accountStatus.toUpperCase())).length
    };
  }, [students]);

  // Action: Create / Onboard Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.username.trim()) {
      toast.error('Student full name and username are required.');
      return;
    }

    setSaving(true);
    try {
      const subjectsArray = form.subjects.split(',').map(s => s.trim()).filter(Boolean);
      const cleanUsername = form.username.trim().toLowerCase().replace(/\s+/g, '');
      const generatedCode = form.accessCode.trim().toUpperCase() || `CADET-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      // 1. Try server backend endpoint if available
      try {
        const idToken = await getAuthToken();
        const resp = await fetch('/api/admin-student-onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            username: cleanUsername,
            email: form.email.trim() || undefined,
            class: form.className.trim() || 'General',
            track: form.track.trim() || 'STEM & Coding',
            subjects: subjectsArray,
            schoolId: form.studentType === 'school' ? form.schoolId : undefined,
            parentId: form.studentType === 'parent' ? form.parentId : undefined,
            tutorId: form.tutorId || undefined,
            accessCode: generatedCode
          })
        });

        if (resp.ok) {
          const result = await resp.json();
          setCredentials({
            fullName: result.student.fullName,
            username: result.credentials.username,
            accessCode: result.credentials.accessCode,
            portal: result.credentials.portal || '/portal/student',
            email: form.email.trim()
          });
          toast.success('Student onboarded with official portal access pack!');
          setShowCreate(false);
          resetForm();
          await loadAllData();
          return;
        }
      } catch (backendErr) {
        console.warn('Backend student onboard fallback to Firestore client write:', backendErr);
      }

      // 2. Client-side Firestore creation
      const studentDocRef = doc(collection(db, 'individualStudents'));
      const now = new Date();
      const schoolObj = schools.find(s => s.id === form.schoolId);
      const parentObj = parents.find(p => p.id === form.parentId);
      const tutorObj = tutors.find(t => t.id === form.tutorId);

      const payload = {
        fullName: form.fullName.trim(),
        studentName: form.fullName.trim(),
        username: cleanUsername,
        email: form.email.trim() || null,
        class: form.className.trim() || 'General',
        grade: form.className.trim() || 'General',
        track: form.track.trim() || 'STEM & Coding',
        subjects: subjectsArray,
        schoolId: form.studentType === 'school' ? form.schoolId : null,
        schoolName: form.studentType === 'school' ? (schoolObj?.name || form.schoolId) : null,
        parentId: form.studentType === 'parent' ? form.parentId : null,
        parentName: form.studentType === 'parent' ? (parentObj?.name || null) : null,
        parentEmail: form.studentType === 'parent' ? (parentObj?.email || null) : null,
        tutorId: form.tutorId || null,
        tutorName: tutorObj?.name || null,
        tutorEmail: tutorObj?.email || null,
        assignedTutorId: form.tutorId || null,
        assignedStaffId: form.tutorId || null,
        accessCode: generatedCode,
        portalAccessEnabled: true,
        accountStatus: 'ACTIVE',
        source: form.studentType === 'school' ? 'school_onboarding' : form.studentType === 'parent' ? 'parent_enrollment' : 'admin_direct',
        createdAt: now,
        updatedAt: now
      };

      await setDoc(studentDocRef, payload);

      setCredentials({
        fullName: form.fullName.trim(),
        username: cleanUsername,
        accessCode: generatedCode,
        portal: '/portal/student',
        email: form.email.trim()
      });

      toast.success(`Cadet "${form.fullName}" added successfully.`);
      setShowCreate(false);
      resetForm();
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to create student: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      studentType: 'personal',
      fullName: '',
      username: '',
      email: '',
      className: '',
      track: 'STEM & Robotics Foundation',
      subjects: 'Coding, Mathematics, Robotics',
      schoolId: '',
      parentId: '',
      tutorId: '',
      accessCode: ''
    });
  };

  // Action: Issue / Re-issue Access Pack
  const issueCredentials = async (student: UnifiedStudent) => {
    setSaving(true);
    try {
      const generatedCode = `CADET-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      
      // Update in Firestore
      const collectionTarget = student.docSource === 'students' ? 'students' : 'individualStudents';
      await setDoc(doc(db, collectionTarget, student.id), {
        accessCode: generatedCode,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setCredentials({
        fullName: student.fullName,
        username: student.username,
        accessCode: generatedCode,
        portal: '/portal/student',
        email: student.email
      });

      toast.success(`New Access Pack generated for ${student.fullName}!`);
      await loadAllData();
    } catch (err: any) {
      toast.error('Could not generate credentials: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Action: Assign Tutor
  const handleAssignTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningTutorStudent) return;
    setSaving(true);
    try {
      const tutorObj = tutors.find(t => t.id === selectedTutorId);
      const tutorName = tutorObj ? tutorObj.name : null;
      const tutorEmail = tutorObj ? tutorObj.email : null;
      const tId = selectedTutorId || null;

      const collectionTarget = assigningTutorStudent.docSource === 'students' ? 'students' : 'individualStudents';
      await updateDoc(doc(db, collectionTarget, assigningTutorStudent.id), {
        tutorId: tId,
        tutorName,
        tutorEmail,
        assignedTutorId: tId,
        assignedStaffId: tId,
        staffId: tId,
        updatedAt: serverTimestamp()
      });

      // Also update user doc if UID exists
      if (assigningTutorStudent.firebaseUid) {
        await updateDoc(doc(db, 'users', assigningTutorStudent.firebaseUid), {
          tutorId: tId,
          tutorName,
          assignedStaffId: tId,
          updatedAt: serverTimestamp()
        }).catch(() => undefined);
      }

      toast.success(tId ? `Assigned mentor ${tutorName} to ${assigningTutorStudent.fullName}.` : `Unassigned mentor from ${assigningTutorStudent.fullName}.`);
      setAssigningTutorStudent(null);
      setSelectedTutorId('');
      await loadAllData();
    } catch (err: any) {
      toast.error('Failed to assign mentor: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Action: Toggle Status (Active / Suspended)
  const toggleStudentStatus = async (student: UnifiedStudent) => {
    const isSuspended = ['SUSPENDED', 'BANNED', 'DISABLED'].includes(student.accountStatus.toUpperCase());
    const nextStatus = isSuspended ? 'ACTIVE' : 'SUSPENDED';

    if (!window.confirm(`Are you sure you want to change ${student.fullName}'s status to ${nextStatus}?`)) return;

    try {
      const collectionTarget = student.docSource === 'students' ? 'students' : 'individualStudents';
      await updateDoc(doc(db, collectionTarget, student.id), {
        accountStatus: nextStatus,
        status: nextStatus,
        portalAccessEnabled: nextStatus === 'ACTIVE',
        updatedAt: serverTimestamp()
      });

      if (student.firebaseUid) {
        await updateDoc(doc(db, 'users', student.firebaseUid), {
          accountStatus: nextStatus,
          status: nextStatus,
          portalAccessEnabled: nextStatus === 'ACTIVE',
          updatedAt: serverTimestamp()
        }).catch(() => undefined);
      }

      toast.success(`Account status updated to ${nextStatus}.`);
      await loadAllData();
    } catch (err: any) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  // Action: Delete Student
  const deleteStudent = async (student: UnifiedStudent) => {
    if (!window.confirm(`Permanently delete ${student.fullName}? This action cannot be undone.`)) return;
    setSaving(true);
    try {
      const collectionTarget = student.docSource === 'students' ? 'students' : 'individualStudents';
      await deleteDoc(doc(db, collectionTarget, student.id));

      if (student.firebaseUid) {
        await deleteDoc(doc(db, 'users', student.firebaseUid)).catch(() => undefined);
      }

      // Cleanup linked dispatches
      const linked = dispatches.filter(item => item.studentId === student.id);
      await Promise.all(linked.map(item => deleteDoc(doc(db, item.collectionName, item.id)).catch(() => undefined)));

      toast.success(`Student record removed.`);
      await loadAllData();
    } catch (err: any) {
      toast.error('Failed to delete student: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Action: Send Personal Resource / Link
  const handleSendResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceForm.studentId || !resourceForm.title.trim() || !resourceForm.url.trim()) {
      toast.error('Please select a student and enter a title and URL.');
      return;
    }

    setSendingResource(true);
    try {
      const selectedStudent = students.find(s => s.id === resourceForm.studentId);
      const collectionName = resourceForm.type === 'link' ? 'personalLinks' : 'personalResources';
      const payload: any = {
        studentId: resourceForm.studentId,
        studentName: selectedStudent?.fullName || 'Cadet',
        title: resourceForm.title.trim(),
        description: resourceForm.description.trim(),
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      if (resourceForm.type === 'link') {
        payload.url = resourceForm.url.trim();
        payload.platform = 'Live Link / Classroom';
      } else {
        payload.fileUrl = resourceForm.url.trim();
        payload.url = resourceForm.url.trim();
      }

      await addDoc(collection(db, collectionName), payload);
      toast.success(`Dispatched ${resourceForm.type} to ${selectedStudent?.fullName || 'student'}!`);
      setResourceForm({ studentId: '', type: 'resource', title: '', url: '', description: '' });
      await loadAllData();
    } catch (err: any) {
      toast.error('Failed to send resource: ' + err.message);
    } finally {
      setSendingResource(false);
    }
  };

  // Action: Export Roster to CSV
  const exportToCSV = () => {
    if (filteredStudents.length === 0) {
      toast.error('No student records to export.');
      return;
    }

    const headers = ['Full Name', 'Username', 'Email', 'Category', 'Class/Grade', 'Learning Track', 'School', 'Parent Name', 'Parent Email', 'Assigned Mentor', 'Status'];
    const rows = filteredStudents.map(s => [
      `"${s.fullName.replace(/"/g, '""')}"`,
      `"${s.username}"`,
      `"${s.email}"`,
      `"${s.studentType.toUpperCase()}"`,
      `"${s.class}"`,
      `"${s.track}"`,
      `"${(s.schoolName || s.schoolId || 'None').replace(/"/g, '""')}"`,
      `"${(s.parentName || 'None').replace(/"/g, '""')}"`,
      `"${s.parentEmail || 'None'}"`,
      `"${(s.tutorName || 'Unassigned').replace(/"/g, '""')}"`,
      `"${s.accountStatus}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jaystarbliss_student_roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Student roster exported to CSV successfully.');
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red dark:bg-brand-red/20">
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white md:text-3xl">
                Scholars &amp; Student Operations
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Centralized academic roster for independent learners, parent-registered scholars, and affiliated school cadets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadAllData()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-4 text-xs font-bold text-slate-700 shadow-xs backdrop-blur-md hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Sync Directory
          </button>
          
          <button
            type="button"
            onClick={exportToCSV}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-4 text-xs font-bold text-slate-700 shadow-xs backdrop-blur-md hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download size={15} aria-hidden="true" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-5 text-xs font-bold text-white shadow-md shadow-brand-red/20 hover:bg-red-700 transition-all"
          >
            <UserPlus size={15} aria-hidden="true" />
            Add Student / Cadet
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="pro-surface rounded-2xl border border-slate-200/80 p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Scholars</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="pro-surface rounded-2xl border border-slate-200/80 p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Personal Learners</p>
          <p className="mt-1 text-2xl font-black text-purple-700 dark:text-purple-300">{stats.personal}</p>
        </div>
        <div className="pro-surface rounded-2xl border border-slate-200/80 p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Parent Enrolled</p>
          <p className="mt-1 text-2xl font-black text-sky-700 dark:text-sky-300">{stats.parent}</p>
        </div>
        <div className="pro-surface rounded-2xl border border-slate-200/80 p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">School Affiliated</p>
          <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">{stats.school}</p>
        </div>
        <div className="pro-surface col-span-2 rounded-2xl border border-slate-200/80 p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/80 md:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Accounts</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{stats.active}</p>
        </div>
      </div>

      {/* Search & Unified Filter Popover Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cadet, username, school, parent..."
            className="w-full min-h-10 pl-9 pr-9 rounded-xl border border-slate-200/90 bg-white text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Dropdown Popover */}
        <div className="relative shrink-0" ref={filterMenuRef}>
          <button
            type="button"
            onClick={() => setIsFilterOpen(prev => !prev)}
            aria-expanded={isFilterOpen}
            className={`min-h-10 px-3.5 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
              typeFilter !== 'all' || schoolFilter !== 'all' || tutorFilter !== 'all' || statusFilter !== 'all'
                ? 'bg-brand-red text-white border-brand-red shadow-xs'
                : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-2xs'
            }`}
          >
            <Filter size={14} className={typeFilter !== 'all' || schoolFilter !== 'all' || tutorFilter !== 'all' || statusFilter !== 'all' ? 'text-white' : 'text-slate-400'} />
            <span>
              {typeFilter === 'all' && schoolFilter === 'all' && tutorFilter === 'all' && statusFilter === 'all'
                ? 'All Filters'
                : typeFilter !== 'all'
                  ? typeFilter === 'personal' ? 'Personal' : typeFilter === 'parent' ? 'Parent' : 'School'
                  : 'Filtered'}
            </span>
            {(typeFilter !== 'all' || schoolFilter !== 'all' || tutorFilter !== 'all' || statusFilter !== 'all') && (
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px] font-mono">
                {filteredStudents.length}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {isFilterOpen && (
            <div className="absolute right-0 sm:left-auto top-full mt-1.5 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-3 z-40 animate-fadeIn space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filter Scholars</span>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('all');
                    setSchoolFilter('all');
                    setTutorFilter('all');
                    setStatusFilter('all');
                    setIsFilterOpen(false);
                  }}
                  className="text-[10px] font-bold text-brand-red hover:underline"
                >
                  Reset All
                </button>
              </div>

              {/* Student Category */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Enrolment Category
                </label>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  {[
                    { id: 'all', label: 'All Cadets', count: stats.total },
                    { id: 'personal', label: 'Personal', count: stats.personal },
                    { id: 'parent', label: 'Parent Enrolled', count: stats.parent },
                    { id: 'school', label: 'School Affiliated', count: stats.school },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTypeFilter(tab.id as any)}
                      className={`px-2 py-1.5 rounded-lg font-bold text-left transition-all text-xs flex items-center justify-between ${
                        typeFilter === tab.id
                          ? 'bg-brand-red text-white'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                      <span className="text-[9px] opacity-70 font-mono ml-1">({tab.count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* School Affiliation */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Partner School
                </label>
                <select
                  value={schoolFilter}
                  onChange={e => setSchoolFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-red cursor-pointer"
                >
                  <option value="all">All Schools &amp; Direct</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Mentor Assignment */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Mentor Assignment
                </label>
                <select
                  value={tutorFilter}
                  onChange={e => setTutorFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-red cursor-pointer"
                >
                  <option value="all">All Mentor Assignments</option>
                  <option value="assigned">Assigned to Mentor</option>
                  <option value="unassigned">Unassigned</option>
                  {tutors.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Mentor)</option>
                  ))}
                </select>
              </div>

              {/* Account Status */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Account Status
                </label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-red cursor-pointer"
                >
                  <option value="all">All Account Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="suspended">Suspended / Inactive</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Student Directory Roster */}
      <section className="pro-surface overflow-hidden rounded-3xl border border-slate-200/80 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Student &amp; Cadet Directory</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Showing {filteredStudents.length} of {students.length} enrolled scholars across all programs.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {filteredStudents.length} Visible
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-brand-red" />
            <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">Synchronizing student records...</p>
            <p className="text-xs text-slate-500">Aggregating personal students, parent registrations, and school rosters.</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p className="mt-3 text-base font-black text-slate-800 dark:text-slate-200">No students match your criteria</p>
            <p className="mt-1 text-xs text-slate-500">Try clearing filters or onboarding a new student below.</p>
            <button
              type="button"
              onClick={() => {
                setTypeFilter('all');
                setSchoolFilter('all');
                setStatusFilter('all');
                setTutorFilter('all');
                setSearch('');
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-brand-red hover:bg-red-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredStudents.map(student => {
              const isSuspended = ['SUSPENDED', 'BANNED', 'DISABLED'].includes(student.accountStatus.toUpperCase());
              
              return (
                <div 
                  key={student.id} 
                  className="flex flex-col gap-4 p-5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 lg:flex-row lg:items-center lg:justify-between"
                >
                  {/* Left: Avatar & Profile Info */}
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-red to-red-700 text-base font-black text-white shadow-xs">
                      {(student.fullName || 'C').charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                          {student.fullName}
                        </p>

                        {/* Category Badge */}
                        {student.studentType === 'school' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <School size={11} />
                            {student.schoolName || 'School Cadet'}
                          </span>
                        ) : student.studentType === 'parent' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            <Users size={11} />
                            Parent Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-extrabold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                            <UserCheck size={11} />
                            Personal Student
                          </span>
                        )}

                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          isSuspended 
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' 
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                        }`}>
                          <ShieldCheck size={11} />
                          {isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </div>

                      {/* User Identifiers */}
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">@{student.username}</span>
                        {student.email && <span>· {student.email}</span>}
                        {student.class && <span>· Class: <strong className="text-slate-700 dark:text-slate-200">{student.class}</strong></span>}
                      </p>

                      {/* Program & Mentor Details */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span>Track: <strong className="text-slate-700 dark:text-slate-300">{student.track || 'STEM Foundation'}</strong></span>
                        
                        {/* Assigned Tutor */}
                        <span className="inline-flex items-center gap-1">
                          Mentor: 
                          {student.tutorName ? (
                            <strong className="text-brand-red">{student.tutorName}</strong>
                          ) : (
                            <span className="italic text-slate-400">Unassigned</span>
                          )}
                        </span>

                        {/* Parent Info if applicable */}
                        {student.parentName && (
                          <span>Parent: <strong className="text-slate-700 dark:text-slate-300">{student.parentName}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Send Resource */}
                    <button
                      type="button"
                      onClick={() => {
                        setResourceForm(prev => ({ ...prev, studentId: student.id }));
                        const elem = document.getElementById('personal-resource-dispatch-card');
                        elem?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 hover:border-brand-red hover:text-brand-red dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Send size={13} />
                      Send Resource
                    </button>

                    {/* Assign Tutor */}
                    <button
                      type="button"
                      onClick={() => {
                        setAssigningTutorStudent(student);
                        setSelectedTutorId(student.tutorId || '');
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 hover:border-purple-600 hover:text-purple-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <UserCheck size={13} />
                      {student.tutorId ? 'Change Mentor' : 'Assign Mentor'}
                    </button>

                    {/* Issue Access Pack */}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => issueCredentials(student)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-brand-red/10 px-3 text-[11px] font-black text-brand-red hover:bg-brand-red hover:text-white transition-colors disabled:opacity-50 dark:bg-brand-red/20"
                    >
                      <KeyRound size={13} />
                      Access Pack
                    </button>

                    {/* Toggle Status */}
                    <button
                      type="button"
                      onClick={() => toggleStudentStatus(student)}
                      className="inline-flex min-h-9 items-center rounded-xl border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      title={isSuspended ? 'Activate account' : 'Suspend account'}
                    >
                      {isSuspended ? 'Activate' : 'Suspend'}
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => deleteStudent(student)}
                      className="inline-flex min-h-9 items-center rounded-xl border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
                      title="Delete student record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Send Personal Learning Resource Section */}
      <section 
        id="personal-resource-dispatch-card"
        className="pro-surface rounded-3xl border border-slate-200/80 p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/80 md:p-8"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red dark:bg-brand-red/20">
            <Send size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Send Personal Learning Resource</h2>
            <p className="text-xs text-slate-500">
              Deliver an interactive class link, lesson sheet, or coding challenge directly into a specific student's portal.
            </p>
          </div>
        </div>

        <form onSubmit={handleSendResource} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Target Student / Cadet <span className="text-brand-red">*</span>
            </label>
            <select
              value={resourceForm.studentId}
              onChange={e => setResourceForm(prev => ({ ...prev, studentId: e.target.value }))}
              className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white"
              required
            >
              <option value="">-- Choose from all {students.length} students --</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.fullName} (@{student.username}) {student.schoolName ? `[${student.schoolName}]` : student.studentType === 'parent' ? '[Parent Enrolled]' : '[Personal]'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Dispatch Format
            </label>
            <select
              value={resourceForm.type}
              onChange={e => setResourceForm(prev => ({ ...prev, type: e.target.value as 'resource' | 'link' }))}
              className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white"
            >
              <option value="resource">File / Curriculum Document (PDF, Slides)</option>
              <option value="link">Live Classroom / Platform URL (Google Meet, Zoom, Scratch)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Resource Title <span className="text-brand-red">*</span>
            </label>
            <input
              type="text"
              value={resourceForm.title}
              onChange={e => setResourceForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Python Loops Workshop Guide or Google Meet Lab"
              className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              URL Link <span className="text-brand-red">*</span>
            </label>
            <input
              type="url"
              value={resourceForm.url}
              onChange={e => setResourceForm(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://drive.google.com/... or https://meet.google.com/..."
              className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Optional Instructions or Notes
            </label>
            <input
              type="text"
              value={resourceForm.description}
              onChange={e => setResourceForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Review exercises 1 through 4 before our Thursday live session."
              className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={sendingResource}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-6 text-xs font-bold text-white shadow-md shadow-brand-red/20 hover:bg-red-700 disabled:opacity-50"
            >
              {sendingResource ? 'Dispatching...' : 'Dispatch to Student Portal'}
              <Send size={14} aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>

      {/* Recent Dispatches Feed */}
      {dispatches.length > 0 && (
        <section className="pro-surface rounded-3xl border border-slate-200/80 p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-base font-black text-slate-900 dark:text-white">Recent Learning Dispatches</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {dispatches.slice(0, 6).map(item => {
              const targetCadet = students.find(s => s.id === item.studentId);
              return (
                <div
                  key={`${item.collectionName}-${item.id}`}
                  className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-brand-red/10 px-2 py-0.5 text-[10px] font-black uppercase text-brand-red">
                        {item.kind}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">Delivered</span>
                    </div>
                    <h3 className="mt-2 text-xs font-black text-slate-900 dark:text-white truncate">
                      {item.title || 'Untitled'}
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-500">
                      To: <strong>{targetCadet?.fullName || 'Cadet'}</strong>
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <a
                      href={item.url || item.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-red hover:underline"
                    >
                      <LinkIcon size={12} />
                      Open Link
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* MODAL: Onboard New Student / Cadet */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Add Student / Cadet</h2>
                <p className="text-xs text-slate-500">
                  Onboard a new scholar with personalized credentials and course assignment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-4">
              {/* Category Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Student Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, studentType: 'personal' }))}
                    className={`rounded-xl p-2.5 text-center text-xs font-bold transition-all ${
                      form.studentType === 'personal'
                        ? 'border-2 border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Personal / Direct
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, studentType: 'parent' }))}
                    className={`rounded-xl p-2.5 text-center text-xs font-bold transition-all ${
                      form.studentType === 'parent'
                        ? 'border-2 border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Parent Enrolled
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, studentType: 'school' }))}
                    className={`rounded-xl p-2.5 text-center text-xs font-bold transition-all ${
                      form.studentType === 'school'
                        ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    School Cadet
                  </button>
                </div>
              </div>

              {/* Basic Details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Full Name <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        fullName: val,
                        username: prev.username || val.toLowerCase().replace(/[^a-z0-9]/g, '')
                      }));
                    }}
                    placeholder="e.g. David Johnson"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cadet Username <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={e => setForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                    placeholder="e.g. david.johnson"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="student@example.com"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Class / Grade Level
                  </label>
                  <input
                    type="text"
                    value={form.className}
                    onChange={e => setForm(prev => ({ ...prev, className: e.target.value }))}
                    placeholder="e.g. Primary 5, Year 7, Cadet Alpha"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* School or Parent Linker */}
              {form.studentType === 'school' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Select Affiliated School <span className="text-brand-red">*</span>
                  </label>
                  <select
                    required
                    value={form.schoolId}
                    onChange={e => setForm(prev => ({ ...prev, schoolId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">-- Choose School --</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.studentType === 'parent' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Link to Parent Account
                  </label>
                  <select
                    value={form.parentId}
                    onChange={e => setForm(prev => ({ ...prev, parentId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">-- Select Parent or Leave Blank --</option>
                    {parents.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mentor Assignment */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Assign Faculty Mentor / Tutor (Optional)
                  </label>
                  <select
                    value={form.tutorId}
                    onChange={e => setForm(prev => ({ ...prev, tutorId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">-- Unassigned (Assign Later) --</option>
                    {tutors.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Custom Access Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.accessCode}
                    onChange={e => setForm(prev => ({ ...prev, accessCode: e.target.value.toUpperCase() }))}
                    placeholder="Leave blank to auto-generate"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono uppercase"
                  />
                </div>
              </div>

              {/* Track & Subjects */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Learning Track
                  </label>
                  <input
                    type="text"
                    value={form.track}
                    onChange={e => setForm(prev => ({ ...prev, track: e.target.value }))}
                    placeholder="e.g. Python & Robotics Track"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Subjects (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={form.subjects}
                    onChange={e => setForm(prev => ({ ...prev, subjects: e.target.value }))}
                    placeholder="Coding, Mathematics, Robotics"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="min-h-11 flex-1 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 flex-1 rounded-xl bg-brand-red text-xs font-bold text-white shadow-md shadow-brand-red/20 hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Creating Cadet...' : 'Onboard Cadet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Assign Tutor */}
      {assigningTutorStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Assign Mentor / Tutor
                </h2>
                <p className="text-xs text-slate-500">
                  Assign a dedicated faculty member to {assigningTutorStudent.fullName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningTutorStudent(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignTutor} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Faculty Mentor
                </label>
                <select
                  value={selectedTutorId}
                  onChange={e => setSelectedTutorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- No Mentor Assigned (Unassign) --</option>
                  {tutors.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Once assigned, this cadet will appear in the selected mentor's workspace console.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningTutorStudent(null)}
                  className="min-h-10 flex-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-10 flex-1 rounded-xl bg-brand-red text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Updating...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: One-Time Access Pack */}
      {credentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-emerald-600 shrink-0" size={20} aria-hidden="true" />
                  <div>
                    <p className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                      Access Pack for {credentials.fullName}
                    </p>
                    <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                      Copy these credentials and deliver them securely to the student or parent.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Student Username</p>
                    <p className="mt-0.5 truncate font-mono text-sm font-black text-slate-900 dark:text-white">
                      {credentials.username}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(credentials.username, 'Username')}
                    className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-brand-red dark:hover:bg-slate-800"
                    title="Copy username"
                  >
                    <Copy size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Student Access Code</p>
                    <p className="mt-0.5 truncate font-mono text-sm font-black text-brand-red dark:text-red-400">
                      {credentials.accessCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(credentials.accessCode, 'Access Code')}
                    className="rounded-lg p-2 text-amber-700 hover:bg-white hover:text-brand-red dark:hover:bg-slate-800"
                    title="Copy access code"
                  >
                    <Copy size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Portal Login Path</p>
                    <p className="mt-0.5 truncate font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      /portal (Select Student Tab)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${window.location.origin}/portal`, 'Portal URL')}
                    className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-brand-red dark:hover:bg-slate-800"
                    title="Copy portal URL"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCredentials(null)}
                className="min-h-11 w-full rounded-xl bg-brand-red text-xs font-bold text-white shadow-md shadow-brand-red/20 hover:bg-red-700"
              >
                Done &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStudents;
