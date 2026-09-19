import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  collection, getDocs, addDoc, deleteDoc, doc, 
  setDoc, query, orderBy, serverTimestamp, updateDoc 
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { 
  School, BookOpen, Plus, Trash2, ExternalLink, 
  FileText, RefreshCw, Loader2, 
  Key, Copy, CheckCircle2, 
  X, Search, UserPlus, HelpCircle
} from 'lucide-react';

interface SchoolData {
  id: string;
  name: string;
  schoolCode?: string;
  contactName?: string;
  contactEmail?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  plan?: string;
  notes?: string;
  status?: string;
  accountStatus?: string;
  icon?: string;
  studentCount?: number;
  createdAt?: any;
}

interface ExamPasscode {
  id: string;
  schoolId: string;
  schoolName?: string;
  examTitle: string;
  subject?: string;
  classLevel?: string;
  passcode: string;
  isActive: boolean;
  validUntil?: string;
  invigilatorName?: string;
  allocatedCadetsCount?: number;
  timestamp?: any;
}

const DEFAULT_SCHOOLS: SchoolData[] = [
  { id: 'peniel', name: 'Peniel Lily Montessori School', schoolCode: 'PENIEL-2026', icon: '🎓', contactEmail: 'peniel@jaystarbliss.com', contactName: 'School Administrator', status: 'ACTIVE' },
  { id: 'southgold', name: 'South Gold Montessori School', schoolCode: 'SOUTHGOLD-2026', icon: '🏆', contactEmail: 'southgold@jaystarbliss.com', contactName: 'School Administrator', status: 'ACTIVE' },
  { id: 'sapphire', name: 'Sapphire Explorer Montessori School', schoolCode: 'SAPPHIRE-2026', icon: '💎', contactEmail: 'sapphire@jaystarbliss.com', contactName: 'School Administrator', status: 'ACTIVE' },
  { id: 'easystars', name: 'Easy Stars Early Years Academy', schoolCode: 'EASYSTARS-2026', icon: '⭐', contactEmail: 'easystars@jaystarbliss.com', contactName: 'School Administrator', status: 'ACTIVE' },
  { id: 'christycaleb', name: 'Christy Caleb International School', schoolCode: 'CHRISTY-2026', icon: '📚', contactEmail: 'christycaleb@jaystarbliss.com', contactName: 'School Administrator', status: 'ACTIVE' },
  { id: 'royalbreed', name: 'Royal Breed Academy', schoolCode: 'ROYALBREED-2026', icon: '👑', contactEmail: 'royalbreed@jaystarbliss.com', contactName: 'School Administrator', status: 'ACTIVE' },
];

const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red';

const AdminSchools: React.FC = () => {
  const { toast } = useToast();
  
  // Navigation & Filter Tabs
  const [activeTab, setActiveTab] = useState<'directory' | 'passcodes' | 'resources' | 'exams'>('directory');
  const [loading, setLoading] = useState(true);
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Data Stores
  const [schools, setSchools] = useState<SchoolData[]>(DEFAULT_SCHOOLS);
  const [passcodes, setPasscodes] = useState<ExamPasscode[]>([]);
  const [schoolResources, setSchoolResources] = useState<any[]>([]);
  const [schoolExams, setSchoolExams] = useState<any[]>([]);

  // Modals & Submissions
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    schoolName: string;
    email: string;
    password: string;
    schoolCode: string;
    contactName: string;
  } | null>(null);

  // Forms
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    contactName: '',
    email: '',
    password: `JBS-School-${Math.floor(1000 + Math.random() * 9000)}!`,
    schoolCode: '',
    phone: '',
    state: 'Lagos',
    address: '',
    plan: 'STEM Partnership Tier 1',
    notes: ''
  });

  const [passcodeForm, setPasscodeForm] = useState({
    schoolId: 'peniel',
    examTitle: '',
    subject: 'Robotics & STEM Practical',
    classLevel: 'Primary 5 & 6',
    passcode: `EXAM-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`,
    invigilatorName: 'School STEM Coordinator'
  });
  const [savingPasscode, setSavingPasscode] = useState(false);

  const [resForm, setResForm] = useState({
    schoolId: 'peniel',
    type: 'resource',
    title: '',
    url: '',
    description: ''
  });
  const [resSubmitting, setResSubmitting] = useState(false);

  const [examForm, setExamForm] = useState({
    schoolId: 'peniel',
    title: '',
    url: '',
    description: ''
  });
  const [examSubmitting, setExamSubmitting] = useState(false);

  // Helper: Name resolution
  const getSchoolName = useCallback((id: string) => {
    return schools.find(item => item.id === id)?.name || id;
  }, [schools]);

  // Main Data Synchronization
  const fetchAllSchoolData = useCallback(async () => {
    setLoading(true);
    try {
      const [schoolsSnap, usersSnap, studentsSnap, indivSnap, rSnap, lSnap, eSnap, passSnap] = await Promise.all([
        getDocs(collection(db, 'schools')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'users')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'students')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'individualStudents')).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'schoolResources'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'schoolResources'))),
        getDocs(query(collection(db, 'schoolLinks'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'schoolLinks'))),
        getDocs(query(collection(db, 'schoolExams'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'schoolExams'))),
        getDocs(collection(db, 'schoolPasscodes')).catch(() => ({ docs: [] }))
      ]);

      // Calculate student count per school
      const schoolStudentCount = new Map<string, number>();
      indivSnap.docs.forEach((d: any) => {
        const sId = d.data().schoolId;
        if (sId) schoolStudentCount.set(sId, (schoolStudentCount.get(sId) || 0) + 1);
      });
      studentsSnap.docs.forEach((d: any) => {
        const sId = d.data().schoolId;
        if (sId) schoolStudentCount.set(sId, (schoolStudentCount.get(sId) || 0) + 1);
      });

      // Build unified schools list
      const schoolMap = new Map<string, SchoolData>();
      DEFAULT_SCHOOLS.forEach(s => {
        schoolMap.set(s.id, { ...s, studentCount: schoolStudentCount.get(s.id) || 0 });
      });

      schoolsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const existing: Partial<SchoolData> = schoolMap.get(d.id) || {};
        schoolMap.set(d.id, {
          ...existing,
          id: d.id,
          name: data.name || data.schoolName || existing.name || 'Partner School',
          schoolCode: data.schoolCode || data.code || existing.schoolCode || `SCH-${d.id.toUpperCase().slice(0, 6)}`,
          contactName: data.contactName || data.coordinator || existing.contactName || 'Administrator',
          contactEmail: data.contactEmail || data.email || existing.contactEmail || '',
          phone: data.phone || existing.phone || '',
          address: data.address || existing.address || '',
          state: data.state || existing.state || '',
          plan: data.plan || existing.plan || 'STEM Partner',
          notes: data.notes || existing.notes || '',
          status: data.status || data.accountStatus || 'ACTIVE',
          studentCount: schoolStudentCount.get(d.id) || 0,
          createdAt: data.createdAt || null
        });
      });

      // Also enrich from users collection (where role is SCHOOL)
      usersSnap.docs.forEach((d: any) => {
        const u = d.data();
        if (String(u.role || '').toUpperCase() === 'SCHOOL' && u.schoolId) {
          const s = schoolMap.get(u.schoolId);
          if (s) {
            if (!s.contactEmail) s.contactEmail = u.email;
            if (!s.contactName) s.contactName = u.name || u.fullName;
          }
        }
      });

      const finalSchools = Array.from(schoolMap.values());
      setSchools(finalSchools);

      // Merge Resources & Links
      const mergedResources: any[] = [];
      rSnap.forEach((d: any) => mergedResources.push({ id: d.id, collectionName: 'schoolResources', kind: 'resource', ...d.data() }));
      lSnap.forEach((d: any) => mergedResources.push({ id: d.id, collectionName: 'schoolLinks', kind: 'link', ...d.data() }));
      mergedResources.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
      setSchoolResources(mergedResources);

      // Exams
      setSchoolExams(eSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })));

      // Passcodes
      setPasscodes(passSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ExamPasscode)));

    } catch (err) {
      console.error('Failed to synchronize school command center:', err);
      toast.error('Unable to synchronize affiliated schools data.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchAllSchoolData();
  }, [fetchAllSchoolData]);

  // Action: Onboard New School (Start to Finish)
  const handleOnboardSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.name.trim() || !onboardForm.contactName.trim() || !onboardForm.email.trim()) {
      toast.error('School name, contact person, and administrator email are required.');
      return;
    }

    setOnboardingSaving(true);
    try {
      const schoolSlug = onboardForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30) || `school-${Date.now()}`;
      const generatedCode = onboardForm.schoolCode.trim().toUpperCase() || `${onboardForm.name.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const now = new Date();

      // 1. Try server backend endpoint if available
      try {
        const user = auth.currentUser;
        if (user) {
          const idToken = await user.getIdToken();
          const resp = await fetch('/.netlify/functions/admin-school-onboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              name: onboardForm.name.trim(),
              contactName: onboardForm.contactName.trim(),
              email: onboardForm.email.trim().toLowerCase(),
              schoolCode: generatedCode,
              phone: onboardForm.phone.trim(),
              state: onboardForm.state.trim(),
              address: onboardForm.address.trim(),
              notes: onboardForm.notes.trim()
            })
          });

          if (resp.ok) {
            const result = await resp.json();
            setCreatedCredentials({
              schoolName: onboardForm.name.trim(),
              email: onboardForm.email.trim().toLowerCase(),
              password: result.temporaryPassword || onboardForm.password,
              schoolCode: generatedCode,
              contactName: onboardForm.contactName.trim()
            });
            setShowOnboardModal(false);
            toast.success(`School "${onboardForm.name}" onboarded successfully!`);
            await fetchAllSchoolData();
            return;
          }
        }
      } catch (backendErr) {
        console.warn('Backend school onboard notice, proceeding with client Firestore record:', backendErr);
      }

      // The server endpoint is authoritative. Do not create a client-only
      // school record because that would not create a Firebase Auth account.
      throw new Error('School onboarding service is temporarily unavailable. Please try again; no incomplete school record was created.');

    } catch (err: any) {
      console.error(err);
      toast.error('Failed to onboard school: ' + (err.message || 'Unknown error'));
    } finally {
      setOnboardingSaving(false);
    }
  };

  // Action: Create Exam Passcode
  const handleCreatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeForm.examTitle.trim() || !passcodeForm.passcode.trim()) {
      toast.error('Exam title and unlock passcode are required.');
      return;
    }

    setSavingPasscode(true);
    try {
      const codeId = `pc-${Date.now()}`;
      const payload: ExamPasscode = {
        id: codeId,
        schoolId: passcodeForm.schoolId,
        schoolName: getSchoolName(passcodeForm.schoolId),
        examTitle: passcodeForm.examTitle.trim(),
        subject: passcodeForm.subject.trim(),
        classLevel: passcodeForm.classLevel.trim(),
        passcode: passcodeForm.passcode.trim().toUpperCase(),
        invigilatorName: passcodeForm.invigilatorName.trim(),
        isActive: true,
        validUntil: 'End of Term',
        timestamp: serverTimestamp()
      };

      await setDoc(doc(db, 'schoolPasscodes', codeId), payload);
      toast.success(`Exam passcode "${payload.passcode}" published for ${getSchoolName(passcodeForm.schoolId)}!`);
      setPasscodeForm(prev => ({
        ...prev,
        examTitle: '',
        passcode: `EXAM-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`
      }));
      await fetchAllSchoolData();
    } catch (err: any) {
      toast.error('Failed to publish passcode: ' + err.message);
    } finally {
      setSavingPasscode(false);
    }
  };

  // Action: Toggle Passcode Active/Inactive
  const togglePasscodeStatus = async (passcode: ExamPasscode) => {
    try {
      const nextState = !passcode.isActive;
      await updateDoc(doc(db, 'schoolPasscodes', passcode.id), {
        isActive: nextState,
        updatedAt: serverTimestamp()
      });
      toast.success(nextState ? 'Passcode activated.' : 'Passcode deactivated.');
      await fetchAllSchoolData();
    } catch (err: any) {
      toast.error('Failed to update passcode: ' + err.message);
    }
  };

  // Action: Delete Passcode
  const deletePasscode = async (id: string, title: string) => {
    if (!window.confirm(`Delete passcode for "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'schoolPasscodes', id));
      toast.success('Exam passcode deleted.');
      await fetchAllSchoolData();
    } catch (err: any) {
      toast.error('Failed to delete passcode: ' + err.message);
    }
  };

  // Action: Deploy Resource to School
  const handlePostSchoolResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.title.trim() || !resForm.url.trim()) {
      toast.error('Please enter a title and resource link.');
      return;
    }
    setResSubmitting(true);
    const collectionName = resForm.type === 'link' ? 'schoolLinks' : 'schoolResources';
    const urlKey = resForm.type === 'link' ? 'url' : 'fileUrl';
    try {
      await addDoc(collection(db, collectionName), {
        schoolId: resForm.schoolId,
        schoolName: getSchoolName(resForm.schoolId),
        title: resForm.title.trim(),
        [urlKey]: resForm.url.trim(),
        url: resForm.url.trim(),
        description: resForm.description.trim(),
        timestamp: serverTimestamp()
      });
      toast.success(`Dispatched ${resForm.type} to ${getSchoolName(resForm.schoolId)}.`);
      setResForm({ schoolId: resForm.schoolId, type: 'resource', title: '', url: '', description: '' });
      await fetchAllSchoolData();
    } catch (err: any) {
      toast.error('Failed to dispatch resource: ' + err.message);
    } finally {
      setResSubmitting(false);
    }
  };

  // Action: Deploy Exam to School
  const handlePostSchoolExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.title.trim() || !examForm.url.trim()) {
      toast.error('Please enter an exam title and Google Forms/Practical link.');
      return;
    }
    setExamSubmitting(true);
    try {
      await addDoc(collection(db, 'schoolExams'), {
        schoolId: examForm.schoolId,
        schoolName: getSchoolName(examForm.schoolId),
        title: examForm.title.trim(),
        url: examForm.url.trim(),
        description: examForm.description.trim(),
        timestamp: serverTimestamp()
      });
      toast.success(`School exam published for ${getSchoolName(examForm.schoolId)}.`);
      setExamForm({ schoolId: examForm.schoolId, title: '', url: '', description: '' });
      await fetchAllSchoolData();
    } catch (err: any) {
      toast.error('Failed to publish exam: ' + err.message);
    } finally {
      setExamSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string, collectionName: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast.success(`Deleted "${title}".`);
      await fetchAllSchoolData();
    } catch (err: any) {
      toast.error('Failed to delete item: ' + err.message);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Filtered views
  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(s => [s.name, s.schoolCode, s.contactName, s.contactEmail, s.state].some(val => String(val || '').toLowerCase().includes(q)));
  }, [schools, search]);

  const filteredPasscodes = useMemo(() => {
    return passcodes.filter(p => selectedSchoolFilter === 'all' || p.schoolId === selectedSchoolFilter);
  }, [passcodes, selectedSchoolFilter]);

  const filteredResources = useMemo(() => {
    return schoolResources.filter(r => selectedSchoolFilter === 'all' || r.schoolId === selectedSchoolFilter);
  }, [schoolResources, selectedSchoolFilter]);

  const filteredExams = useMemo(() => {
    return schoolExams.filter(e => selectedSchoolFilter === 'all' || e.schoolId === selectedSchoolFilter);
  }, [schoolExams, selectedSchoolFilter]);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red dark:bg-brand-red/20">
              <School className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white md:text-3xl">
                Affiliated Schools Command
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Institutional partnerships, school administrator credentials, student exam unlock codes, and academic assets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fetchAllSchoolData()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-4 text-xs font-bold text-slate-700 shadow-xs backdrop-blur-md hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh Hub
          </button>

          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-5 text-xs font-bold text-white shadow-md shadow-brand-red/20 hover:bg-red-700 transition-all"
          >
            <UserPlus size={15} aria-hidden="true" />
            Onboard New School
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2 dark:border-slate-800" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'directory'}
          onClick={() => setActiveTab('directory')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
            activeTab === 'directory'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <School size={15} />
          Partner School Directory ({schools.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'passcodes'}
          onClick={() => setActiveTab('passcodes')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
            activeTab === 'passcodes'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
          }`}
        >
          <Key size={15} />
          Exam Unlock Passcodes ({passcodes.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'resources'}
          onClick={() => setActiveTab('resources')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
            activeTab === 'resources'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300'
          }`}
        >
          <BookOpen size={15} />
          School Resources &amp; Links ({schoolResources.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'exams'}
          onClick={() => setActiveTab('exams')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
            activeTab === 'exams'
              ? 'bg-brand-red text-white shadow-xs'
              : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          <FileText size={15} />
          Assessments &amp; Practical Exams ({schoolExams.length})
        </button>
      </div>

      {/* TAB 1: Partner School Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="pro-surface rounded-2xl border border-slate-200/80 p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={16} aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search partner school by name, code, contact or email..."
                className="w-full rounded-xl border border-slate-200/80 bg-white/70 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-brand-red focus:outline-none dark:border-slate-800 dark:bg-slate-950/70 dark:text-white"
              />
            </div>
          </div>

          {/* School Cards Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSchools.map(school => (
              <article
                key={school.id}
                className="pro-surface flex flex-col justify-between rounded-3xl border border-slate-200/80 p-6 shadow-xs transition-all hover:border-brand-red/40 dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{school.icon || '🏫'}</span>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                          {school.name}
                        </h3>
                        <span className="font-mono text-[11px] font-bold text-brand-red">
                          {school.schoolCode || `ID: ${school.id}`}
                        </span>
                      </div>
                    </div>
                    
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {school.status || 'Active'}
                    </span>
                  </div>

                  {/* School Metadata Details */}
                  <div className="mt-4 space-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800/60 dark:bg-slate-950/50 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Enrolled Cadets:</span>
                      <strong className="text-slate-900 dark:text-white font-mono text-sm">
                        {school.studentCount || 0} Students
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Admin Email:</span>
                      <span className="font-mono truncate max-w-[170px] text-[11px] text-slate-700 dark:text-slate-300">
                        {school.contactEmail || 'admin@school.com'}
                      </span>
                    </div>

                    {school.contactName && (
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">Coordinator:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {school.contactName}
                        </span>
                      </div>
                    )}

                    {school.state && (
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">State / Region:</span>
                        <span>{school.state}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSchoolFilter(school.id);
                      setActiveTab('passcodes');
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/50 py-2 text-[11px] font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    <Key size={13} />
                    Exam Codes
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSchoolFilter(school.id);
                      setResForm(prev => ({ ...prev, schoolId: school.id }));
                      setActiveTab('resources');
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/50 py-2 text-[11px] font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300"
                  >
                    <BookOpen size={13} />
                    Deploy Assets
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Exam Passcodes & Unlock Codes */}
      {activeTab === 'passcodes' && (
        <div className="space-y-6">
          {/* Explanatory Banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-xs text-amber-900 dark:text-amber-200">
            <HelpCircle size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <strong className="block text-sm font-black mb-1">
                How School Credentials &amp; Exam Passcodes Work
              </strong>
              <p className="leading-relaxed">
                <strong>School Administrators</strong> log into the School Console with their individual <strong>Email and Password</strong>.
                The <strong>Exam Unlock Codes</strong> generated below are special one-time assessment passcodes distributed to students in that school so they can unlock timed practical exams in their student portals.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Passcode Generator Form */}
            <div className="pro-surface rounded-3xl border border-slate-200/80 p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
              <h2 className="mb-2 flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
                <Key size={18} className="text-amber-600" />
                Generate Exam Unlock Code
              </h2>
              <p className="mb-5 text-xs text-slate-500">
                Issue a secure unlock code for students of a specific school to take an upcoming exam.
              </p>

              <form onSubmit={handleCreatePasscode} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Target Affiliated School <span className="text-brand-red">*</span>
                  </label>
                  <select
                    value={passcodeForm.schoolId}
                    onChange={e => setPasscodeForm({ ...passcodeForm, schoolId: e.target.value })}
                    className={inputClass}
                  >
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Exam Title / Assessment <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={passcodeForm.examTitle}
                    onChange={e => setPasscodeForm({ ...passcodeForm, examTitle: e.target.value })}
                    placeholder="e.g. Term 2 Robotics & Python Practical"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={passcodeForm.subject}
                      onChange={e => setPasscodeForm({ ...passcodeForm, subject: e.target.value })}
                      placeholder="e.g. STEM Practical"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Class Level
                    </label>
                    <input
                      type="text"
                      value={passcodeForm.classLevel}
                      onChange={e => setPasscodeForm({ ...passcodeForm, classLevel: e.target.value })}
                      placeholder="e.g. Primary 5"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Exam Unlock Code <span className="text-brand-red">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={passcodeForm.passcode}
                      onChange={e => setPasscodeForm({ ...passcodeForm, passcode: e.target.value.toUpperCase() })}
                      className={inputClass + ' font-mono uppercase text-sm font-bold'}
                    />
                    <button
                      type="button"
                      onClick={() => setPasscodeForm(prev => ({
                        ...prev,
                        passcode: `EXAM-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`
                      }))}
                      className="rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Regen
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPasscode}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 disabled:opacity-50"
                >
                  {savingPasscode ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                  Publish Exam Passcode
                </button>
              </form>
            </div>

            {/* Active Passcodes List */}
            <div className="space-y-4 lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Active Exam Passcodes ({filteredPasscodes.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Students input these codes inside their student portal to unlock protected exams.
                  </p>
                </div>

                <select
                  value={selectedSchoolFilter}
                  onChange={e => setSelectedSchoolFilter(e.target.value)}
                  className="w-auto rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="all">All Schools</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {filteredPasscodes.length === 0 ? (
                <div className="pro-surface rounded-3xl border border-slate-200/80 p-12 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900/80">
                  <Key className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">No exam unlock codes active</p>
                  <p className="text-xs text-slate-500 mt-1">Generate a code above to allow students to take their exams.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredPasscodes.map(item => (
                    <article
                      key={item.id}
                      className="pro-surface flex flex-col justify-between rounded-2xl border border-slate-200/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/80"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded bg-amber-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 truncate max-w-[200px]">
                            {getSchoolName(item.schoolId)}
                          </span>

                          <button
                            type="button"
                            onClick={() => deletePasscode(item.id, item.examTitle)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Delete passcode"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <h3 className="mt-2 text-sm font-black text-slate-900 dark:text-white">
                          {item.examTitle}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.subject} · {item.classLevel}
                        </p>

                        {/* Passcode Box */}
                        <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Unlock Code</span>
                            <p className="font-mono text-sm font-black text-brand-red">
                              {item.passcode}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.passcode, 'Exam Passcode')}
                            className="rounded-lg p-2 text-amber-800 hover:bg-white dark:hover:bg-slate-800"
                            title="Copy code"
                          >
                            <Copy size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                        <span className={`font-bold ${item.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {item.isActive ? '● Active Code' : '○ Inactive'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasscodeStatus(item)}
                          className="text-slate-600 hover:text-brand-red font-bold dark:text-slate-400"
                        >
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: School Resources & Links */}
      {activeTab === 'resources' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Dispatch form */}
          <div className="pro-surface rounded-3xl border border-slate-200/80 p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="mb-2 flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
              <Plus size={18} className="text-brand-red" />
              Deploy School Resource
            </h2>
            <p className="mb-5 text-xs text-slate-500">
              Publish curriculum files, PDFs or platform links restricted to a selected partner school.
            </p>

            <form onSubmit={handlePostSchoolResource} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Target School</label>
                <select
                  value={resForm.schoolId}
                  onChange={e => setResForm({ ...resForm, schoolId: e.target.value })}
                  className={inputClass}
                >
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Resource Type</label>
                <select
                  value={resForm.type}
                  onChange={e => setResForm({ ...resForm, type: e.target.value })}
                  className={inputClass}
                >
                  <option value="resource">Curriculum File / Document</option>
                  <option value="link">Interactive Platform Link</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Title</label>
                <input
                  type="text"
                  required
                  value={resForm.title}
                  onChange={e => setResForm({ ...resForm, title: e.target.value })}
                  placeholder="e.g. Grade 5 Robotics Syllabus"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">URL Link</label>
                <input
                  type="url"
                  required
                  value={resForm.url}
                  onChange={e => setResForm({ ...resForm, url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  rows={3}
                  value={resForm.description}
                  onChange={e => setResForm({ ...resForm, description: e.target.value })}
                  placeholder="Instructions for the school teachers and students"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={resSubmitting}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-bold text-white shadow-md shadow-brand-red/20 hover:bg-red-700 disabled:opacity-50"
              >
                {resSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Dispatch to School Portal
              </button>
            </form>
          </div>

          {/* Resources List */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                School Materials &amp; Guides ({filteredResources.length})
              </h2>
              <select
                value={selectedSchoolFilter}
                onChange={e => setSelectedSchoolFilter(e.target.value)}
                className="w-auto rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="all">All Schools</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {filteredResources.length === 0 ? (
              <div className="pro-surface rounded-3xl border border-slate-200/80 p-12 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900/80">
                No materials published for the selected school.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredResources.map(item => (
                  <article
                    key={item.id}
                    className="pro-surface flex flex-col justify-between rounded-2xl border border-slate-200/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-sky-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 truncate max-w-[200px]">
                          {getSchoolName(item.schoolId)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.collectionName, item.title)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <h3 className="mt-2 text-sm font-black text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {item.description || 'No instructions provided.'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <a
                        href={item.url || item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                      >
                        <ExternalLink size={13} />
                        Open Material
                      </a>
                      <span className="text-[10px] text-slate-400">
                        {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: School Assessments & Exams */}
      {activeTab === 'exams' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Exam Deployment Form */}
          <div className="pro-surface rounded-3xl border border-slate-200/80 p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="mb-2 flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
              <Plus size={18} className="text-brand-red" />
              Deploy School Exam
            </h2>
            <p className="mb-5 text-xs text-slate-500">
              Publish official term assessments and coding practicals to a partner school.
            </p>

            <form onSubmit={handlePostSchoolExam} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Target School</label>
                <select
                  value={examForm.schoolId}
                  onChange={e => setExamForm({ ...examForm, schoolId: e.target.value })}
                  className={inputClass}
                >
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Exam Title</label>
                <input
                  type="text"
                  required
                  value={examForm.title}
                  onChange={e => setExamForm({ ...examForm, title: e.target.value })}
                  placeholder="e.g. End of Term STEM Practical Exam"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Google Form / Practical Link</label>
                <input
                  type="url"
                  required
                  value={examForm.url}
                  onChange={e => setExamForm({ ...examForm, url: e.target.value })}
                  placeholder="https://forms.google.com/..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Instructions</label>
                <textarea
                  rows={3}
                  value={examForm.description}
                  onChange={e => setExamForm({ ...examForm, description: e.target.value })}
                  placeholder="Duration, allowed tools, guidelines"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={examSubmitting}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-bold text-white shadow-md shadow-brand-red/20 hover:bg-red-700 disabled:opacity-50"
              >
                {examSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Deploy Examination
              </button>
            </form>
          </div>

          {/* Active Exams List */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Published School Assessments ({filteredExams.length})
              </h2>
              <select
                value={selectedSchoolFilter}
                onChange={e => setSelectedSchoolFilter(e.target.value)}
                className="w-auto rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="all">All Schools</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {filteredExams.length === 0 ? (
              <div className="pro-surface rounded-3xl border border-slate-200/80 p-12 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900/80">
                No active exams deployed for this school.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredExams.map(item => (
                  <article
                    key={item.id}
                    className="pro-surface flex flex-col justify-between rounded-2xl border border-slate-200/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-brand-red/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-brand-red truncate max-w-[200px]">
                          {getSchoolName(item.schoolId)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, 'schoolExams', item.title)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <h3 className="mt-2 text-sm font-black text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {item.description || 'Guidelines provided inside examination portal.'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                      >
                        <ExternalLink size={13} />
                        Launch Exam
                      </a>
                      <span className="text-[10px] text-slate-400">
                        {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Onboard School Directly */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Onboard Partner School
                </h2>
                <p className="text-xs text-slate-500">
                  Provision school administrator account, email &amp; password credentials, and institutional code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOnboardModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleOnboardSchool} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  School Name <span className="text-brand-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={onboardForm.name}
                  onChange={e => {
                    const val = e.target.value;
                    setOnboardForm(prev => ({
                      ...prev,
                      name: val,
                      schoolCode: prev.schoolCode || `${val.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}-2026`
                    }));
                  }}
                  placeholder="e.g. Apex Horizon International Academy"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Administrator Name <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardForm.contactName}
                    onChange={e => setOnboardForm({ ...onboardForm, contactName: e.target.value })}
                    placeholder="e.g. Mrs. Sarah Adebayo"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Administrator Email (Login) <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={onboardForm.email}
                    onChange={e => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    placeholder="admin@school.com or gmail"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Temporary Password <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardForm.password}
                    onChange={e => setOnboardForm({ ...onboardForm, password: e.target.value })}
                    className={inputClass + ' font-mono'}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Custom School Code
                  </label>
                  <input
                    type="text"
                    value={onboardForm.schoolCode}
                    onChange={e => setOnboardForm({ ...onboardForm, schoolCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. APEX-2026"
                    className={inputClass + ' font-mono uppercase'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Phone Contact
                  </label>
                  <input
                    type="tel"
                    value={onboardForm.phone}
                    onChange={e => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                    placeholder="+234 800 000 0000"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    State / City
                  </label>
                  <input
                    type="text"
                    value={onboardForm.state}
                    onChange={e => setOnboardForm({ ...onboardForm, state: e.target.value })}
                    placeholder="Lagos State"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  School Address
                </label>
                <input
                  type="text"
                  value={onboardForm.address}
                  onChange={e => setOnboardForm({ ...onboardForm, address: e.target.value })}
                  placeholder="Street address, campus location"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Partnership Notes
                </label>
                <textarea
                  rows={2}
                  value={onboardForm.notes}
                  onChange={e => setOnboardForm({ ...onboardForm, notes: e.target.value })}
                  placeholder="e.g. Approved following curriculum meeting. Lab days on Tuesdays & Thursdays."
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="min-h-11 flex-1 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardingSaving}
                  className="min-h-11 flex-1 rounded-xl bg-brand-red text-xs font-bold text-white shadow-md shadow-brand-red/20 hover:bg-red-700 disabled:opacity-50"
                >
                  {onboardingSaving ? 'Onboarding School...' : 'Complete Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: One-Time School Credentials Pack */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-emerald-600 shrink-0" size={20} aria-hidden="true" />
                  <div>
                    <p className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                      School Credentials Issued
                    </p>
                    <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                      Send these credentials to {createdCredentials.contactName} ({createdCredentials.schoolName}). The school administrator can log in directly and request a password reset anytime.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">School Admin Email</p>
                    <p className="mt-0.5 truncate font-mono text-xs font-black text-slate-900 dark:text-white">
                      {createdCredentials.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdCredentials.email, 'Admin Email')}
                    className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-brand-red dark:hover:bg-slate-800"
                  >
                    <Copy size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Temporary Password</p>
                    <p className="mt-0.5 truncate font-mono text-sm font-black text-brand-red dark:text-red-400">
                      {createdCredentials.password}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdCredentials.password, 'Password')}
                    className="rounded-lg p-2 text-amber-700 hover:bg-white hover:text-brand-red dark:hover:bg-slate-800"
                  >
                    <Copy size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Institutional School Code</p>
                    <p className="mt-0.5 truncate font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {createdCredentials.schoolCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdCredentials.schoolCode, 'School Code')}
                    className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-brand-red dark:hover:bg-slate-800"
                  >
                    <Copy size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Portal Login Path</p>
                    <p className="mt-0.5 truncate font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      /portal (School Tab)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${window.location.origin}/portal`, 'Portal URL')}
                    className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-brand-red dark:hover:bg-slate-800"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
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

export default AdminSchools;
