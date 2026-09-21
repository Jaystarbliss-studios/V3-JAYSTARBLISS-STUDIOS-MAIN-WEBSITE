import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  collection, getDocs, addDoc, deleteDoc, doc, 
  setDoc, query, serverTimestamp, updateDoc, where
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { 
  School, BookOpen, Plus, Trash2, ExternalLink, 
  FileText, RefreshCw, Loader2, 
  Key, Copy, 
  X, Search,
  KeyRound, ArrowLeft,
  CreditCard, Bell, ShieldCheck, Check,
  Users, Code, ChevronRight, Edit3, Send
} from 'lucide-react';
import { formatNaira, billingPost } from '../../lib/billing';

export interface AssignedTutorAllocation {
  tutorId: string;
  tutorName: string;
  tutorEmail?: string;
  payoutRate: number; // in NGN
  payoutType: 'per_student' | 'per_term' | 'per_month' | 'fixed_stipend';
  role?: 'lead' | 'co_tutor' | 'assistant' | 'lab_engineer';
  notes?: string;
}

export interface SchoolProgram {
  id: string;
  name: string;
  description: string;
  level?: string;
  schedule?: string;
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED' | 'PAUSED';
  assignedTutors?: AssignedTutorAllocation[];
  baseFee?: number;
  costPerStudent?: number;
}

export interface SchoolBillingConfig {
  baseAmount: number;
  cycle: 'monthly' | 'termly'; // monthly = 4 weeks, termly = 12 weeks
  allowedModes: ('advance_monthly' | 'advance_termly' | 'post_monthly' | 'post_termly')[];
  mode: 'advance_monthly' | 'advance_termly' | 'post_monthly' | 'post_termly';
  nextDueDate?: string;
  status?: 'ACTIVE' | 'PAID' | 'DUE' | 'OVERDUE';
  notes?: string;
  lastReminderSentAt?: string;
}

export interface SchoolData {
  id: string;
  name: string;
  schoolCode?: string;
  contactName?: string;
  contactEmail?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  notes?: string;
  status?: string;
  accountStatus?: string;
  icon?: string;
  studentCount?: number;
  programs?: SchoolProgram[];
  assignedTutors?: AssignedTutorAllocation[];
  billing?: SchoolBillingConfig;
  createdAt?: any;
  updatedAt?: any;
  adminUid?: string;
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
  createdAt?: any;
}

interface SchoolResource {
  id: string;
  schoolId: string;
  title: string;
  url: string;
  category?: string;
  description?: string;
  createdAt?: any;
}

interface CadetRecord {
  id: string;
  fullName?: string;
  studentName?: string;
  username?: string;
  email?: string;
  class?: string;
  grade?: string;
  status?: string;
  schoolId?: string;
}

const DEFAULT_PROGRAMS: SchoolProgram[] = [];

const DEFAULT_SCHOOLS: SchoolData[] = [
  { 
    id: 'peniel', 
    name: 'Peniel Lily Montessori School', 
    schoolCode: 'PENIEL-2026', 
    icon: '🎓', 
    contactEmail: 'peniel@jaystarbliss.com', 
    contactName: 'School Administrator', 
    state: 'Lagos',
    status: 'ACTIVE',
    programs: [],
    billing: {
      baseAmount: 350000,
      cycle: 'termly',
      allowedModes: ['advance_termly', 'advance_monthly', 'post_termly'],
      mode: 'advance_termly',
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'ACTIVE',
      notes: 'Full institutional lab suite and weekend mentorship access.'
    }
  },
  { 
    id: 'southgold', 
    name: 'South Gold Montessori School', 
    schoolCode: 'SOUTHGOLD-2026', 
    icon: '🏆', 
    contactEmail: 'southgold@jaystarbliss.com', 
    contactName: 'School Administrator', 
    state: 'Lagos',
    status: 'ACTIVE',
    programs: [],
    billing: {
      baseAmount: 280000,
      cycle: 'termly',
      allowedModes: ['advance_termly', 'post_termly'],
      mode: 'advance_termly',
      nextDueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'ACTIVE'
    }
  },
  { 
    id: 'sapphire', 
    name: 'Sapphire Explorer Montessori School', 
    schoolCode: 'SAPPHIRE-2026', 
    icon: '💎', 
    contactEmail: 'sapphire@jaystarbliss.com', 
    contactName: 'School Administrator', 
    state: 'Lagos',
    status: 'ACTIVE',
    programs: [],
    billing: {
      baseAmount: 320000,
      cycle: 'monthly',
      allowedModes: ['advance_monthly', 'post_monthly'],
      mode: 'advance_monthly',
      nextDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'ACTIVE'
    }
  },
  { 
    id: 'easystars', 
    name: 'Easy Stars Early Years Academy', 
    schoolCode: 'EASYSTARS-2026', 
    icon: '⭐', 
    contactEmail: 'easystars@jaystarbliss.com', 
    contactName: 'School Administrator', 
    state: 'Lagos',
    status: 'ACTIVE',
    programs: [],
    billing: {
      baseAmount: 250000,
      cycle: 'termly',
      allowedModes: ['advance_termly', 'advance_monthly'],
      mode: 'advance_termly',
      nextDueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'ACTIVE'
    }
  },
  { 
    id: 'christycaleb', 
    name: 'Christy Caleb International School', 
    schoolCode: 'CHRISTY-2026', 
    icon: '📚', 
    contactEmail: 'christycaleb@jaystarbliss.com', 
    contactName: 'School Administrator', 
    state: 'Ogun',
    status: 'ACTIVE',
    programs: [],
    billing: {
      baseAmount: 300000,
      cycle: 'termly',
      allowedModes: ['advance_termly', 'post_termly'],
      mode: 'advance_termly',
      status: 'ACTIVE'
    }
  },
  { 
    id: 'royalbreed', 
    name: 'Royal Breed Academy', 
    schoolCode: 'ROYALBREED-2026', 
    icon: '👑', 
    contactEmail: 'royalbreed@jaystarbliss.com', 
    contactName: 'School Administrator', 
    state: 'Lagos',
    status: 'ACTIVE',
    programs: [],
    billing: {
      baseAmount: 260000,
      cycle: 'monthly',
      allowedModes: ['advance_monthly'],
      mode: 'advance_monthly',
      status: 'ACTIVE'
    }
  }
];

const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red transition-all';
const labelClass = 'block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

const AdminSchools: React.FC = () => {
  const { toast } = useToast();
  
  // State
  const [schools, setSchools] = useState<SchoolData[]>(DEFAULT_SCHOOLS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [activeSchoolTab, setActiveSchoolTab] = useState<'profile' | 'programs' | 'tutors' | 'billing' | 'passcodes' | 'resources' | 'cadets' | 'raw'>('profile');

  // Sub-stores for selected school
  const [passcodes, setPasscodes] = useState<ExamPasscode[]>([]);
  const [resources, setResources] = useState<SchoolResource[]>([]);
  const [cadets, setCadets] = useState<CadetRecord[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  // Modals & Forms
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    schoolCode: '',
    contactName: '',
    contactEmail: '',
    phone: '',
    state: 'Lagos',
    address: '',
    initialFee: '350000',
    cycle: 'termly' as 'monthly' | 'termly',
    mode: 'advance_termly' as any,
    initialProgramName: '',
    initialProgramDesc: ''
  });

  // Selected school edit forms
  const [profileForm, setProfileForm] = useState<Partial<SchoolData>>({});
  const [billingForm, setBillingForm] = useState<SchoolBillingConfig>({
    baseAmount: 300000,
    cycle: 'termly',
    allowedModes: ['advance_termly', 'advance_monthly', 'post_monthly', 'post_termly'],
    mode: 'advance_termly',
    nextDueDate: '',
    status: 'ACTIVE',
    notes: ''
  });
  const [programsList, setProgramsList] = useState<SchoolProgram[]>([]);
  const [editingProgram, setEditingProgram] = useState<SchoolProgram | null>(null);
  const [isNewProgram, setIsNewProgram] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string; name: string; email: string; role?: string }[]>([]);
  const [catalogPrograms, setCatalogPrograms] = useState<{ id: string; name: string; description: string; level?: string }[]>([]);

  // New Passcode Form
  const [passcodeForm, setPasscodeForm] = useState({
    examTitle: '',
    subject: '',
    classLevel: '',
    passcode: '',
    invigilatorName: '',
    validUntil: ''
  });
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);

  // New Resource Form
  const [resourceForm, setResourceForm] = useState({
    title: '',
    url: '',
    category: 'Curriculum & Lab Manual',
    description: ''
  });
  const [showResourceModal, setShowResourceModal] = useState(false);

  const [savingAction, setSavingAction] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load all schools and faculty/catalog
  const loadSchools = useCallback(async () => {
    setLoading(true);
    try {
      const [snap, usersSnap, progsSnap] = await Promise.all([
        getDocs(collection(db, 'schools')),
        getDocs(collection(db, 'users')).catch(() => null),
        getDocs(collection(db, 'programs')).catch(() => null)
      ]);

      if (usersSnap && !usersSnap.empty) {
        const staffUsers: { id: string; name: string; email: string; role?: string }[] = [];
        usersSnap.docs.forEach(d => {
          const u = d.data();
          const r = String(u.role || '').toLowerCase();
          if (['tutor', 'staff', 'instructor', 'faculty'].includes(r)) {
            staffUsers.push({
              id: d.id,
              name: u.name || u.displayName || u.fullName || u.email || 'Faculty Instructor',
              email: u.email || '',
              role: r
            });
          }
        });
        if (staffUsers.length > 0) setStaffList(staffUsers);
      }

      if (progsSnap && !progsSnap.empty) {
        const catProgs = progsSnap.docs.map(d => {
          const p = d.data();
          return {
            id: d.id,
            name: p.title || p.name || 'STEM Programme',
            description: p.shortDescription || p.description || '',
            level: p.targetAudience || p.level || p.grade || 'All Grades'
          };
        });
        setCatalogPrograms(catProgs);
      } else {
        setCatalogPrograms([]);
      }

      if (!snap.empty) {
        const firestoreSchools = snap.docs.map(d => ({
          id: d.id,
          programs: [],
          ...(d.data() as Omit<SchoolData, 'id'>)
        }));

        // Merge with DEFAULT_SCHOOLS so pre-seeded institutions are retained
        const mergedMap = new Map<string, SchoolData>();
        DEFAULT_SCHOOLS.forEach(s => mergedMap.set(s.id, s));
        firestoreSchools.forEach(s => mergedMap.set(s.id, { ...mergedMap.get(s.id), ...s }));
        setSchools(Array.from(mergedMap.values()));
      } else {
        // Seed default schools to firestore if empty
        setSchools(DEFAULT_SCHOOLS);
        for (const defaultSchool of DEFAULT_SCHOOLS) {
          try {
            await setDoc(doc(db, 'schools', defaultSchool.id), {
              ...defaultSchool,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });
          } catch {
            // non-blocking
          }
        }
      }
    } catch (err) {
      console.warn('Unable to load schools from firestore:', err);
      setSchools(DEFAULT_SCHOOLS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  // Selected school object
  const selectedSchool = useMemo(() => {
    if (!selectedSchoolId) return null;
    return schools.find(s => s.id === selectedSchoolId) || null;
  }, [selectedSchoolId, schools]);

  // Load school specific data when a school is opened
  useEffect(() => {
    if (!selectedSchool) return;

    // Populate local edit forms
    setProfileForm({
      name: selectedSchool.name || '',
      schoolCode: selectedSchool.schoolCode || '',
      contactName: selectedSchool.contactName || '',
      contactEmail: selectedSchool.contactEmail || selectedSchool.email || '',
      phone: selectedSchool.phone || '',
      state: selectedSchool.state || 'Lagos',
      address: selectedSchool.address || '',
      status: selectedSchool.status || 'ACTIVE',
      notes: selectedSchool.notes || ''
    });

    setBillingForm({
      baseAmount: selectedSchool.billing?.baseAmount ?? 300000,
      cycle: selectedSchool.billing?.cycle || 'termly',
      allowedModes: selectedSchool.billing?.allowedModes || ['advance_termly', 'advance_monthly', 'post_monthly', 'post_termly'],
      mode: selectedSchool.billing?.mode || 'advance_termly',
      nextDueDate: selectedSchool.billing?.nextDueDate || '',
      status: selectedSchool.billing?.status || 'ACTIVE',
      notes: selectedSchool.billing?.notes || '',
      lastReminderSentAt: selectedSchool.billing?.lastReminderSentAt || ''
    });

    setProgramsList(Array.isArray(selectedSchool.programs) ? selectedSchool.programs : []);

    // Fetch related records: passcodes, resources, cadets, payments
    const fetchSchoolDetails = async () => {
      try {
        const [passSnap, resSnap, studSnap, indivSnap, paySnap] = await Promise.all([
          getDocs(query(collection(db, 'schoolPasscodes'), where('schoolId', '==', selectedSchool.id))),
          getDocs(query(collection(db, 'schoolLinks'), where('schoolId', '==', selectedSchool.id))),
          getDocs(query(collection(db, 'students'), where('schoolId', '==', selectedSchool.id))),
          getDocs(query(collection(db, 'individualStudents'), where('schoolId', '==', selectedSchool.id))),
          getDocs(query(collection(db, 'payments'), where('schoolId', '==', selectedSchool.id)))
        ]);

        setPasscodes(passSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamPasscode)));
        setResources(resSnap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolResource)));
        
        const cadetsList = [
          ...studSnap.docs.map(d => ({ id: d.id, ...d.data() } as CadetRecord)),
          ...indivSnap.docs.map(d => ({ id: d.id, ...d.data() } as CadetRecord))
        ];
        setCadets(cadetsList);
        setPayments(paySnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.warn('Error fetching school sub-records:', err);
      }
    };

    void fetchSchoolDetails();
  }, [selectedSchool]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered Schools list
  const filteredSchools = useMemo(() => {
    return schools.filter(s => {
      const q = search.toLowerCase();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.schoolCode?.toLowerCase().includes(q) ||
        s.contactEmail?.toLowerCase().includes(q) ||
        s.contactName?.toLowerCase().includes(q) ||
        s.state?.toLowerCase().includes(q)
      );
    });
  }, [schools, search]);

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return;
    setSavingAction(true);
    try {
      const updatedData = {
        ...profileForm,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'schools', selectedSchool.id), updatedData, { merge: true });
      
      setSchools(prev => prev.map(s => s.id === selectedSchool.id ? { ...s, ...profileForm } : s));
      toast.success('School profile updated successfully.');
    } catch (err) {
      console.error('Save profile failed:', err);
      toast.error('Unable to save school profile.');
    } finally {
      setSavingAction(false);
    }
  };

  // Save Billing Changes
  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return;
    setSavingAction(true);
    try {
      const cleanBaseAmount = Number(String(billingForm.baseAmount || 0).replace(/[^0-9.]/g, '')) || 0;
      const updatedBilling = {
        ...billingForm,
        baseAmount: cleanBaseAmount
      };

      // 1. Direct Firestore update on school document
      await setDoc(doc(db, 'schools', selectedSchool.id), {
        billing: updatedBilling,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Sync to linked school administrator user record in Firestore
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('schoolId', '==', selectedSchool.id)));
        if (!usersSnap.empty) {
          for (const uDoc of usersSnap.docs) {
            await setDoc(doc(db, 'users', uDoc.id), {
              billing: updatedBilling,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        }
      } catch (uErr) {
        console.warn('School user billing sync notice:', uErr);
      }

      // 3. Billing post helper for backend / notifications
      try {
        await billingPost('billing-admin', {
          action: 'set_school_billing',
          schoolId: selectedSchool.id,
          baseAmount: cleanBaseAmount,
          cycle: billingForm.cycle,
          allowedModes: billingForm.allowedModes,
          mode: billingForm.mode,
          nextDueDate: billingForm.nextDueDate || '',
          status: billingForm.status,
          notes: billingForm.notes || ''
        });
      } catch (postErr) {
        console.debug('Background billing post notice:', postErr);
      }

      setBillingForm(updatedBilling);
      setSchools(prev => prev.map(s => s.id === selectedSchool.id ? { ...s, billing: updatedBilling } : s));
      toast.success(`Institutional billing configuration saved for ${selectedSchool.name}.`);
    } catch (err) {
      console.error('Save billing failed:', err);
      toast.error(err instanceof Error ? err.message : 'Unable to update billing configuration.');
    } finally {
      setSavingAction(false);
    }
  };

  // Send Payment Reminder
  const handleSendReminder = async () => {
    if (!selectedSchool) return;
    setSendingReminder(true);
    try {
      const nowIso = new Date().toISOString();
      await billingPost('billing-admin', {
        action: 'send_payment_reminder',
        targetType: 'SCHOOL',
        targetId: selectedSchool.id,
        recipientId: selectedSchool.adminUid || selectedSchool.id,
        email: selectedSchool.contactEmail || selectedSchool.email,
        amount: billingForm.baseAmount,
        nextDueDate: billingForm.nextDueDate,
        title: `Tuition & Lab Subscription Due - ${selectedSchool.name}`
      });

      setBillingForm(prev => ({ ...prev, lastReminderSentAt: nowIso }));
      setSchools(prev => prev.map(s => s.id === selectedSchool.id ? {
        ...s,
        billing: { ...(s.billing || billingForm), lastReminderSentAt: nowIso }
      } : s));

      toast.success(`Payment reminder issued to ${selectedSchool.name}.`);
    } catch (err) {
      console.error('Send reminder failed:', err);
      toast.error(err instanceof Error ? err.message : 'Unable to dispatch payment reminder.');
    } finally {
      setSendingReminder(false);
    }
  };

  // Save Programs List
  const handleSavePrograms = async (updatedPrograms: SchoolProgram[]) => {
    if (!selectedSchool) return;
    setSavingAction(true);
    try {
      await setDoc(doc(db, 'schools', selectedSchool.id), {
        programs: updatedPrograms,
        updatedAt: serverTimestamp()
      }, { merge: true });

      try {
        await billingPost('billing-admin', {
          action: 'update_school_programs',
          schoolId: selectedSchool.id,
          programs: updatedPrograms
        });
      } catch (postErr) {
        console.debug('Background programs sync notice:', postErr);
      }

      setProgramsList(updatedPrograms);
      setSchools(prev => prev.map(s => s.id === selectedSchool.id ? { ...s, programs: updatedPrograms } : s));
      toast.success('Programmes list updated.');
      setEditingProgram(null);
      setIsNewProgram(false);
    } catch (err) {
      console.error('Save programs failed:', err);
      toast.error('Unable to update programmes.');
    } finally {
      setSavingAction(false);
    }
  };

  // Add / Edit Program Submit
  const handleProgramSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgram || !editingProgram.name.trim()) {
      toast.error('Programme name is required.');
      return;
    }

    let updated: SchoolProgram[];
    if (isNewProgram) {
      const newEntry: SchoolProgram = {
        ...editingProgram,
        id: editingProgram.id || `prog-${Date.now()}`
      };
      updated = [...programsList, newEntry];
    } else {
      updated = programsList.map(p => p.id === editingProgram.id ? editingProgram : p);
    }

    void handleSavePrograms(updated);
  };

  // Delete Program
  const handleDeleteProgram = (progId: string) => {
    if (!window.confirm('Are you sure you want to delete this programme? It will be removed from this school.')) {
      return;
    }
    const updated = programsList.filter(p => p.id !== progId);
    void handleSavePrograms(updated);
  };

  // Create Passcode
  const handleCreatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return;
    if (!passcodeForm.examTitle.trim() || !passcodeForm.passcode.trim()) {
      toast.error('Exam title and passcode are required.');
      return;
    }
    setSavingAction(true);
    try {
      const passcodeData = {
        schoolId: selectedSchool.id,
        schoolName: selectedSchool.name,
        examTitle: passcodeForm.examTitle.trim(),
        subject: passcodeForm.subject.trim(),
        classLevel: passcodeForm.classLevel.trim(),
        passcode: passcodeForm.passcode.trim().toUpperCase(),
        invigilatorName: passcodeForm.invigilatorName.trim(),
        validUntil: passcodeForm.validUntil || '',
        isActive: true,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'schoolPasscodes'), passcodeData);
      setPasscodes(prev => [{ id: docRef.id, ...passcodeData }, ...prev]);
      setShowPasscodeModal(false);
      setPasscodeForm({ examTitle: '', subject: '', classLevel: '', passcode: '', invigilatorName: '', validUntil: '' });
      toast.success('Exam passcode generated.');
    } catch (err) {
      console.error('Create passcode failed:', err);
      toast.error('Unable to generate passcode.');
    } finally {
      setSavingAction(false);
    }
  };

  // Delete Passcode
  const handleDeletePasscode = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schoolPasscodes', id));
      setPasscodes(prev => prev.filter(p => p.id !== id));
      toast.success('Passcode removed.');
    } catch {
      toast.error('Unable to remove passcode.');
    }
  };

  // Toggle Passcode Status
  const handleTogglePasscode = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'schoolPasscodes', id), { isActive: !currentStatus });
      setPasscodes(prev => prev.map(p => p.id === id ? { ...p, isActive: !currentStatus } : p));
      toast.success(`Passcode ${!currentStatus ? 'activated' : 'deactivated'}.`);
    } catch {
      toast.error('Unable to update passcode status.');
    }
  };

  // Create Resource Link
  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return;
    if (!resourceForm.title.trim() || !resourceForm.url.trim()) {
      toast.error('Resource title and URL are required.');
      return;
    }
    setSavingAction(true);
    try {
      const resData = {
        schoolId: selectedSchool.id,
        title: resourceForm.title.trim(),
        url: resourceForm.url.trim(),
        category: resourceForm.category.trim(),
        description: resourceForm.description.trim(),
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'schoolLinks'), resData);
      setResources(prev => [{ id: docRef.id, ...resData }, ...prev]);
      setShowResourceModal(false);
      setResourceForm({ title: '', url: '', category: 'Curriculum & Lab Manual', description: '' });
      toast.success('Resource link published for school.');
    } catch (err) {
      console.error('Create resource failed:', err);
      toast.error('Unable to add resource.');
    } finally {
      setSavingAction(false);
    }
  };

  // Delete Resource
  const handleDeleteResource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schoolLinks', id));
      setResources(prev => prev.filter(r => r.id !== id));
      toast.success('Resource removed.');
    } catch {
      toast.error('Unable to delete resource.');
    }
  };

  // Send Password Reset Link
  const handleSendPasswordReset = async (email: string) => {
    if (!email) {
      toast.error('No contact email configured for this school.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(`Password reset email sent to ${email}`);
    } catch (err) {
      console.error('Password reset failed:', err);
      toast.error('Unable to send password reset email.');
    }
  };

  // Onboard New School
  const handleOnboardSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.name.trim() || !onboardForm.contactEmail.trim()) {
      toast.error('School name and administrator email are required.');
      return;
    }

    setOnboardingSaving(true);
    try {
      const schoolId = (onboardForm.schoolCode || onboardForm.name)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 15) || `school-${Date.now()}`;

      const generatedCode = onboardForm.schoolCode || `${onboardForm.name.slice(0, 4).toUpperCase()}-2026`;

      const newSchoolRecord: SchoolData = {
        id: schoolId,
        name: onboardForm.name.trim(),
        schoolCode: generatedCode,
        contactName: onboardForm.contactName.trim() || 'School Administrator',
        contactEmail: onboardForm.contactEmail.trim().toLowerCase(),
        phone: onboardForm.phone.trim(),
        state: onboardForm.state.trim() || 'Lagos',
        address: onboardForm.address.trim(),
        status: 'ACTIVE',
        programs: onboardForm.initialProgramName.trim()
          ? [
              {
                id: `prog-${Date.now()}`,
                name: onboardForm.initialProgramName.trim(),
                description: onboardForm.initialProgramDesc.trim(),
                status: 'ACTIVE'
              }
            ]
          : [],
        billing: {
          baseAmount: Number(onboardForm.initialFee) || 350000,
          cycle: onboardForm.cycle,
          allowedModes: [onboardForm.mode, 'advance_termly', 'advance_monthly'],
          mode: onboardForm.mode,
          nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          status: 'ACTIVE',
          notes: 'Standard institutional curriculum and lab partnership agreement.'
        }
      };

      await setDoc(doc(db, 'schools', schoolId), {
        ...newSchoolRecord,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSchools(prev => [newSchoolRecord, ...prev]);
      setShowOnboardModal(false);
      setSelectedSchoolId(schoolId);
      toast.success(`${newSchoolRecord.name} onboarded successfully!`);
    } catch (err) {
      console.error('Onboarding failed:', err);
      toast.error('Unable to onboard new school.');
    } finally {
      setOnboardingSaving(false);
    }
  };

  // Quick stats
  const totalSchoolsCount = schools.length;
  const activeSchoolsCount = schools.filter(s => s.status !== 'SUSPENDED').length;
  const totalProgramsCount = schools.reduce((acc, s) => acc + (s.programs?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* View 1: Detailed Single School Workspace */}
      {selectedSchool ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Bar with Back Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setSelectedSchoolId(null)}
                className="min-h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all"
              >
                <ArrowLeft size={16} /> Back to Schools
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                    {selectedSchool.name}
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    selectedSchool.status === 'SUSPENDED' 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' 
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                  }`}>
                    {selectedSchool.status || 'ACTIVE'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-mono font-bold text-brand-red bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-md">
                    {selectedSchool.schoolCode || selectedSchool.id.toUpperCase()}
                  </span>
                  <span>•</span>
                  <span>{selectedSchool.contactEmail || selectedSchool.email || 'No email registered'}</span>
                  <span>•</span>
                  <span>{selectedSchool.state || 'Lagos'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSendPasswordReset(selectedSchool.contactEmail || selectedSchool.email || '')}
                className="min-h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all"
              >
                <KeyRound size={14} /> Send Password Reset
              </button>
            </div>
          </div>

          {/* School Workspace Scoped Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2 overflow-x-auto">
            {[
              { id: 'profile', label: 'Overview & Profile', icon: <School size={15} /> },
              { id: 'programs', label: `Undergoing Programmes (${programsList.length})`, icon: <BookOpen size={15} /> },
              { id: 'tutors', label: `Assigned Tutors & Payouts`, icon: <Users size={15} /> },
              { id: 'billing', label: 'Billing & Custom Fees', icon: <CreditCard size={15} /> },
              { id: 'passcodes', label: `Exam Passcodes (${passcodes.length})`, icon: <Key size={15} /> },
              { id: 'resources', label: `Curriculum & Links (${resources.length})`, icon: <FileText size={15} /> },
              { id: 'cadets', label: `Enrolled Cadets (${cadets.length})`, icon: <Users size={15} /> },
              { id: 'raw', label: 'Firestore Data', icon: <Code size={15} /> }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSchoolTab(tab.id as any)}
                className={`min-h-10 px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-2 transition-all ${
                  activeSchoolTab === tab.id
                    ? 'bg-brand-red text-white shadow-sm shadow-red-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Profile & Overview */}
          {activeSchoolTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">School Profile & Institutional Details</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Primary administrative credentials, coordinator contacts, and location data.</p>
                  </div>
                  <School className="text-brand-red" size={20} />
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>School Name</label>
                      <input
                        required
                        value={profileForm.name || ''}
                        onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Institutional School Code</label>
                      <input
                        required
                        value={profileForm.schoolCode || ''}
                        onChange={e => setProfileForm(p => ({ ...p, schoolCode: e.target.value.toUpperCase() }))}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Administrator / Coordinator Name</label>
                      <input
                        value={profileForm.contactName || ''}
                        onChange={e => setProfileForm(p => ({ ...p, contactName: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Administrator Email Address</label>
                      <input
                        type="email"
                        required
                        value={profileForm.contactEmail || ''}
                        onChange={e => setProfileForm(p => ({ ...p, contactEmail: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Phone Number</label>
                      <input
                        value={profileForm.phone || ''}
                        onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>State / Region</label>
                      <input
                        value={profileForm.state || ''}
                        onChange={e => setProfileForm(p => ({ ...p, state: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Campus Physical Address</label>
                    <input
                      value={profileForm.address || ''}
                      onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Administrative Notes & Partnership Context</label>
                    <textarea
                      rows={3}
                      value={profileForm.notes || ''}
                      onChange={e => setProfileForm(p => ({ ...p, notes: e.target.value }))}
                      className={inputClass}
                      placeholder="Special curriculum requests, equipment notes, or partnership terms..."
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingAction}
                      className="min-h-11 px-6 rounded-xl bg-brand-red hover:bg-red-700 text-white font-black text-xs inline-flex items-center gap-2 shadow-sm transition-all"
                    >
                      {savingAction ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                      Save Profile Changes
                    </button>
                  </div>
                </form>
              </div>

              {/* Quick Summary Card */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">Quick Institutional Snapshot</h3>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">School ID:</span>
                      <span className="font-mono font-bold">{selectedSchool.id}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Active Programmes:</span>
                      <span className="font-bold text-brand-red">{programsList.length} Active</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Enrolled Cadets:</span>
                      <span className="font-bold text-emerald-600">{cadets.length} Students</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Configured Fee:</span>
                      <span className="font-black">{formatNaira(billingForm.baseAmount)} / {billingForm.cycle}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-500">Active Passcodes:</span>
                      <span className="font-bold">{passcodes.filter(p => p.isActive).length} Valid</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Undergoing Programmes (Single or Multiple with Multi-Tutor Assignments & Rates) */}
          {activeSchoolTab === 'programs' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Active Programmes & Multi-Tutor Deployment</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assign one or multiple STEM programmes, laboratory scopes, and assign multiple tutors with custom payout rates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProgram({
                      id: '',
                      name: '',
                      description: '',
                      level: 'Primary 4 - SSS 3',
                      schedule: 'Weekly STEM Lab (2 Sessions / Week)',
                      status: 'ACTIVE',
                      baseFee: 0,
                      assignedTutors: []
                    });
                    setIsNewProgram(true);
                  }}
                  className="min-h-11 px-4 rounded-xl bg-brand-red hover:bg-red-700 text-white font-black text-xs inline-flex items-center gap-2 shadow-sm transition-all"
                >
                  <Plus size={16} /> Add New Programme
                </button>
              </div>

              {/* Edit/Add Program Modal / Form */}
              {editingProgram && (
                <div className="bg-slate-50 dark:bg-slate-950/60 border-2 border-brand-red/30 rounded-3xl p-6 animate-fadeIn space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {isNewProgram ? 'Deploy New Programme & Assign Tutors' : 'Edit Programme & Tutor Allocations'}
                      </h3>
                      <p className="text-[11px] text-slate-500">Configure curriculum details and assign one or more instructors with their payment allocations.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingProgram(null)}
                      className="min-h-9 min-w-9 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Preset catalog picker */}
                  {isNewProgram && catalogPrograms.length > 0 && (
                    <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                        Quick Select From STEM Catalog:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {catalogPrograms.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setEditingProgram(prev => prev ? {
                                ...prev,
                                name: cat.name,
                                description: cat.description,
                                level: cat.level || 'All Grades'
                              } : null);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                              editingProgram.name === cat.name
                                ? 'bg-brand-red text-white border-brand-red'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-red'
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleProgramSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Programme Title</label>
                        <input
                          required
                          value={editingProgram.name}
                          onChange={e => setEditingProgram(p => p ? { ...p, name: e.target.value } : null)}
                          placeholder="e.g. Smart Robotics & IoT Lab"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Target Grade / Cohort</label>
                        <input
                          value={editingProgram.level || ''}
                          onChange={e => setEditingProgram(p => p ? { ...p, level: e.target.value } : null)}
                          placeholder="e.g. Primary 4-6, JSS 1-3"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Lab Days & Time Schedule</label>
                        <input
                          value={editingProgram.schedule || ''}
                          onChange={e => setEditingProgram(p => p ? { ...p, schedule: e.target.value } : null)}
                          placeholder="e.g. Tuesdays & Thursdays, 10am - 12pm"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Status</label>
                        <select
                          value={editingProgram.status}
                          onChange={e => setEditingProgram(p => p ? { ...p, status: e.target.value as any } : null)}
                          className={inputClass}
                        >
                          <option value="ACTIVE">Active (Ongoing)</option>
                          <option value="UPCOMING">Upcoming / Next Term</option>
                          <option value="PAUSED">Paused</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Program Specific Fee (Optional ₦)</label>
                        <input
                          type="number"
                          min="0"
                          value={editingProgram.baseFee || ''}
                          onChange={e => setEditingProgram(p => p ? { ...p, baseFee: Number(e.target.value) || 0 } : null)}
                          placeholder="e.g. 150000"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Programme Description & Curriculum Scope</label>
                      <textarea
                        rows={3}
                        required
                        value={editingProgram.description}
                        onChange={e => setEditingProgram(p => p ? { ...p, description: e.target.value } : null)}
                        placeholder="Comprehensive details on what the cadets will learn, technologies covered, and practical goals..."
                        className={inputClass}
                      />
                    </div>

                    {/* ASSIGNED TUTORS & MULTI-TUTOR ALLOCATION SECTION */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                            <Users size={14} className="text-brand-red" />
                            Assigned Instructors & Tutors (Multi-Tutor Assignment)
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            You can assign two or more tutors to this program and define their individual payout amount.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const defaultTutor = staffList[0] || { id: `staff-${Date.now()}`, name: '', email: '' };
                            const newAlloc: AssignedTutorAllocation = {
                              tutorId: defaultTutor.id,
                              tutorName: defaultTutor.name,
                              tutorEmail: defaultTutor.email,
                              payoutRate: 45000,
                              payoutType: 'per_term',
                              role: (editingProgram.assignedTutors?.length || 0) === 0 ? 'lead' : 'co_tutor',
                              notes: ''
                            };
                            setEditingProgram(p => p ? {
                              ...p,
                              assignedTutors: [...(p.assignedTutors || []), newAlloc]
                            } : null);
                          }}
                          className="min-h-8 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-brand-red dark:bg-red-950/40 text-xs font-black inline-flex items-center gap-1.5 transition-all"
                        >
                          <Plus size={13} /> + Add Another Tutor
                        </button>
                      </div>

                      {(!editingProgram.assignedTutors || editingProgram.assignedTutors.length === 0) ? (
                        <div className="p-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500">
                          No tutors assigned yet to this program. Click <strong>"+ Add Another Tutor"</strong> above to assign instructors and set their payment rates.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {editingProgram.assignedTutors.map((alloc, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                            >
                              <div className="md:col-span-4">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Tutor / Instructor</label>
                                {staffList.length > 0 ? (
                                  <select
                                    value={alloc.tutorId}
                                    onChange={e => {
                                      const selected = staffList.find(s => s.id === e.target.value);
                                      const updatedAlloc = [...(editingProgram.assignedTutors || [])];
                                      updatedAlloc[idx] = {
                                        ...alloc,
                                        tutorId: e.target.value,
                                        tutorName: selected?.name || alloc.tutorName,
                                        tutorEmail: selected?.email || alloc.tutorEmail
                                      };
                                      setEditingProgram(p => p ? { ...p, assignedTutors: updatedAlloc } : null);
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                                  >
                                    {staffList.map(s => (
                                      <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    value={alloc.tutorName}
                                    onChange={e => {
                                      const updatedAlloc = [...(editingProgram.assignedTutors || [])];
                                      updatedAlloc[idx] = { ...alloc, tutorName: e.target.value };
                                      setEditingProgram(p => p ? { ...p, assignedTutors: updatedAlloc } : null);
                                    }}
                                    placeholder="Tutor Full Name"
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                                  />
                                )}
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Role</label>
                                <select
                                  value={alloc.role || 'lead'}
                                  onChange={e => {
                                    const updatedAlloc = [...(editingProgram.assignedTutors || [])];
                                    updatedAlloc[idx] = { ...alloc, role: e.target.value as any };
                                    setEditingProgram(p => p ? { ...p, assignedTutors: updatedAlloc } : null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                                >
                                  <option value="lead">Lead Instructor</option>
                                  <option value="co_tutor">Co-Tutor / Assistant</option>
                                  <option value="lab_engineer">Lab Engineer</option>
                                  <option value="assistant">Teaching Assistant</option>
                                </select>
                              </div>

                              <div className="md:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Tutor Payment (₦ NGN)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  value={alloc.payoutRate}
                                  onChange={e => {
                                    const updatedAlloc = [...(editingProgram.assignedTutors || [])];
                                    updatedAlloc[idx] = { ...alloc, payoutRate: Number(e.target.value) || 0 };
                                    setEditingProgram(p => p ? { ...p, assignedTutors: updatedAlloc } : null);
                                  }}
                                  placeholder="e.g. 50000"
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-emerald-600"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Payment Type</label>
                                <select
                                  value={alloc.payoutType || 'per_term'}
                                  onChange={e => {
                                    const updatedAlloc = [...(editingProgram.assignedTutors || [])];
                                    updatedAlloc[idx] = { ...alloc, payoutType: e.target.value as any };
                                    setEditingProgram(p => p ? { ...p, assignedTutors: updatedAlloc } : null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                                >
                                  <option value="per_term">Per Term</option>
                                  <option value="per_month">Per Month</option>
                                  <option value="per_student">Per Student</option>
                                  <option value="fixed_stipend">Fixed Stipend</option>
                                </select>
                              </div>

                              <div className="md:col-span-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedAlloc = (editingProgram.assignedTutors || []).filter((_, i) => i !== idx);
                                    setEditingProgram(p => p ? { ...p, assignedTutors: updatedAlloc } : null);
                                  }}
                                  className="min-h-8 min-w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center justify-center transition-all"
                                  title="Remove Tutor"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingProgram(null)}
                        className="min-h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingAction}
                        className="min-h-10 px-5 rounded-xl bg-brand-red text-white text-xs font-black inline-flex items-center gap-2"
                      >
                        {savingAction ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                        Save Programme & Tutor Assignments
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Programs List Cards or Empty State */}
              {programsList.length === 0 && !editingProgram ? (
                <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/40 text-brand-red flex items-center justify-center mb-4">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No Active Programmes Assigned Yet</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    This school currently has no active programmes. Click below to add a custom curriculum or STEM laboratory track.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProgram({
                        id: '',
                        name: '',
                        description: '',
                        level: 'Primary 4 - SSS 3',
                        schedule: 'Weekly STEM Lab (2 Sessions / Week)',
                        status: 'ACTIVE',
                        baseFee: 0,
                        assignedTutors: []
                      });
                      setIsNewProgram(true);
                    }}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <Plus size={14} />
                    <span>Add New Programme</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {programsList.map(prog => (
                    <div
                      key={prog.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-brand-red dark:bg-red-950/40">
                                {prog.status}
                              </span>
                              {prog.baseFee ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40">
                                  ₦{prog.baseFee.toLocaleString()}
                                </span>
                              ) : null}
                            </div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white mt-2">
                              {prog.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProgram(prog);
                                setIsNewProgram(false);
                              }}
                              className="min-h-8 min-w-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all"
                              title="Edit Programme & Tutors"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProgram(prog.id)}
                              className="min-h-8 min-w-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-all"
                              title="Delete Programme"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                          {prog.description}
                        </p>

                        {/* Render Assigned Tutors */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Users size={12} className="text-brand-red" />
                              Assigned Tutors ({prog.assignedTutors?.length || 0}):
                            </span>
                          </div>
                          {(!prog.assignedTutors || prog.assignedTutors.length === 0) ? (
                            <p className="text-[11px] text-slate-400 italic">No tutors assigned yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {prog.assignedTutors.map((t, idx) => (
                                <div
                                  key={idx}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-[11px] flex items-center gap-2"
                                >
                                  <span className="font-bold text-slate-900 dark:text-white">{t.tutorName}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-brand-red dark:bg-red-950/60">
                                    {t.role || 'Tutor'}
                                  </span>
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    ₦{Number(t.payoutRate || 0).toLocaleString()} <span className="text-[9px] text-slate-400">/{t.payoutType?.replace('per_', '') || 'term'}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex flex-col gap-1.5">
                        {prog.level && <div><strong className="text-slate-700 dark:text-slate-300">Target Cohort:</strong> {prog.level}</div>}
                        {prog.schedule && <div><strong className="text-slate-700 dark:text-slate-300">Schedule:</strong> {prog.schedule}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Assigned Tutors & Institutional Payout Overview */}
          {activeSchoolTab === 'tutors' && (
            <div className="space-y-6">
              {/* Financial Commitment & Payout Margin Metrics */}
              {(() => {
                const allAssigned = programsList.flatMap(p => (p.assignedTutors || []).map(t => ({ ...t, programName: p.name })));
                const totalTutorCommitment = allAssigned.reduce((sum, t) => sum + (Number(t.payoutRate) || 0), 0);
                const schoolFee = Number(billingForm.baseAmount || 0);
                const netMargin = Math.max(0, schoolFee - totalTutorCommitment);

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Assigned Instructors</span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                          {allAssigned.length}
                        </div>
                        <span className="text-[11px] text-slate-500">Across {programsList.length} programs</span>
                      </div>

                      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Total Faculty Payout</span>
                        <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 font-mono">
                          ₦{totalTutorCommitment.toLocaleString()}
                        </div>
                        <span className="text-[11px] text-slate-500">Per billing cycle</span>
                      </div>

                      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">School Invoiced Fee</span>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                          ₦{schoolFee.toLocaleString()}
                        </div>
                        <span className="text-[11px] text-slate-500">{billingForm.cycle} cycle</span>
                      </div>

                      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Net Institutional Margin</span>
                        <div className="text-2xl font-black text-brand-red mt-1 font-mono">
                          ₦{netMargin.toLocaleString()}
                        </div>
                        <span className="text-[11px] text-slate-500">Platform operational surplus</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">Assigned Faculty Directory & Payment Rates</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Instructors actively assigned to {selectedSchool.name} programmes and their contractual compensation.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveSchoolTab('programs')}
                          className="min-h-10 px-4 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all"
                        >
                          <Edit3 size={14} /> Manage Programmes & Tutor Allocations
                        </button>
                      </div>

                      {allAssigned.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-500">
                          No faculty assigned to {selectedSchool.name} yet. Switch to the <strong>Undergoing Programmes</strong> tab to assign tutors and define their payout rates.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400">
                                <th className="py-3 px-4">Faculty / Tutor</th>
                                <th className="py-3 px-4">Assigned Programme</th>
                                <th className="py-3 px-4">Role</th>
                                <th className="py-3 px-4">Assigned Payout Rate</th>
                                <th className="py-3 px-4">Frequency</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                              {allAssigned.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                    <div>{item.tutorName}</div>
                                    {item.tutorEmail && <div className="text-[10px] text-slate-400 font-normal">{item.tutorEmail}</div>}
                                  </td>
                                  <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                                    {item.programName}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-50 text-brand-red dark:bg-red-950/40">
                                      {item.role || 'Tutor'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                    ₦{Number(item.payoutRate || 0).toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4 text-slate-500 capitalize">
                                    {item.payoutType?.replace('per_', '') || 'Termly'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: Billing, Fees & Payment Plans */}
          {activeSchoolTab === 'billing' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">Admin-Controlled Institutional Billing</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure custom pricing, billing cycles (Monthly / Termly), and payment modes for this partner school.
                    </p>
                  </div>
                  <CreditCard className="text-brand-red" size={20} />
                </div>

                <form onSubmit={handleSaveBilling} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Custom Base Fee (₦ NGN)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="1000"
                        value={billingForm.baseAmount}
                        onChange={e => setBillingForm(b => ({ ...b, baseAmount: Number(e.target.value) }))}
                        className={inputClass}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">This exact amount will appear on the school's billing panel.</p>
                    </div>

                    <div>
                      <label className={labelClass}>Billing Frequency / Cycle</label>
                      <select
                        value={billingForm.cycle}
                        onChange={e => setBillingForm(b => ({ ...b, cycle: e.target.value as any }))}
                        className={inputClass}
                      >
                        <option value="monthly">Monthly Plan (4 Weeks Cycle)</option>
                        <option value="termly">Termly Plan (12 Weeks / Full Term)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Default Payment Mode</label>
                      <select
                        value={billingForm.mode}
                        onChange={e => setBillingForm(b => ({ ...b, mode: e.target.value as any }))}
                        className={inputClass}
                      >
                        <option value="advance_monthly">Advance Monthly (Upfront 4 weeks)</option>
                        <option value="advance_termly">Advance Termly (Upfront 12 weeks)</option>
                        <option value="post_monthly">Post Month (End of month invoice)</option>
                        <option value="post_termly">Post Term (End of term invoice)</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Next Billing Due Date</label>
                      <input
                        type="date"
                        value={billingForm.nextDueDate || ''}
                        onChange={e => setBillingForm(b => ({ ...b, nextDueDate: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Allowed Payment Mode Options for School Admin</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {[
                        { id: 'advance_monthly', label: 'Advance Monthly' },
                        { id: 'advance_termly', label: 'Advance Termly' },
                        { id: 'post_monthly', label: 'Post Monthly' },
                        { id: 'post_termly', label: 'Post Termly' }
                      ].map(modeOpt => {
                        const isChecked = billingForm.allowedModes.includes(modeOpt.id as any);
                        return (
                          <label key={modeOpt.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const current = billingForm.allowedModes;
                                const next = e.target.checked
                                  ? [...current, modeOpt.id as any]
                                  : current.filter(m => m !== modeOpt.id);
                                setBillingForm(b => ({ ...b, allowedModes: next.length ? next : [modeOpt.id as any] }));
                              }}
                              className="rounded text-brand-red focus:ring-brand-red"
                            />
                            <span>{modeOpt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Billing Terms & Notes</label>
                    <textarea
                      rows={2}
                      value={billingForm.notes || ''}
                      onChange={e => setBillingForm(b => ({ ...b, notes: e.target.value }))}
                      placeholder="Special discount terms, physical lab kit allocation, or payment invoice notes..."
                      className={inputClass}
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-3">
                    <button
                      type="submit"
                      disabled={savingAction}
                      className="min-h-11 px-6 rounded-xl bg-brand-red hover:bg-red-700 text-white font-black text-xs inline-flex items-center gap-2 shadow-sm transition-all"
                    >
                      {savingAction ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                      Save Billing Settings
                    </button>
                  </div>
                </form>
              </div>

              {/* Reminders & Invoice Status */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-brand-red font-black text-xs uppercase tracking-wider mb-2">
                    <Bell size={14} /> Due Date & Reminders
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Issue Payment Reminder</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Dispatches a prominent renewal notification banner to this school's billing center and sends an email notification.
                  </p>

                  <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Scheduled Due Date:</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {billingForm.nextDueDate ? new Date(billingForm.nextDueDate).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : 'Not Scheduled'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Last Reminder Sent:</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {billingForm.lastReminderSentAt ? new Date(billingForm.lastReminderSentAt).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={sendingReminder}
                    onClick={handleSendReminder}
                    className="mt-4 w-full min-h-11 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-black text-xs inline-flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    {sendingReminder ? <Loader2 className="animate-spin" size={16} /> : <Send size={15} />}
                    Issue / Send Payment Reminder
                  </button>
                </div>

                {/* Verified Transactions */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Recorded Payment Invoices</h3>
                  {payments.length ? (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto">
                      {payments.map(p => (
                        <div key={p.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                          <div className="flex justify-between font-bold">
                            <span>{formatNaira(p.customerTotal || p.baseAmount || 0)}</span>
                            <span className="text-emerald-600 font-mono text-[10px] uppercase">{p.status || 'PAID'}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-NG') : 'Recent'} • {p.reference || p.id}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      No recorded payment invoices for this school yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Exam Unlock Passcodes for this School */}
          {activeSchoolTab === 'passcodes' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Exam Unlock Passcodes</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate and manage secure CBT practical exam passcodes specifically for {selectedSchool.name}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasscodeModal(true)}
                  className="min-h-11 px-4 rounded-xl bg-brand-red hover:bg-red-700 text-white font-black text-xs inline-flex items-center gap-2 shadow-sm transition-all"
                >
                  <Plus size={16} /> Generate Exam Passcode
                </button>
              </div>

              {/* Passcode Modal */}
              {showPasscodeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                  <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        Generate Exam Unlock Passcode
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowPasscodeModal(false)}
                        className="min-h-9 min-w-9 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleCreatePasscode} className="space-y-4">
                      <div>
                        <label className={labelClass}>Exam / Assessment Title</label>
                        <input
                          required
                          value={passcodeForm.examTitle}
                          onChange={e => setPasscodeForm(p => ({ ...p, examTitle: e.target.value }))}
                          placeholder="e.g. Mid-Term Robotics Practical Examination"
                          className={inputClass}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Subject / Track</label>
                          <input
                            value={passcodeForm.subject}
                            onChange={e => setPasscodeForm(p => ({ ...p, subject: e.target.value }))}
                            placeholder="e.g. Robotics & IoT"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Class / Level</label>
                          <input
                            value={passcodeForm.classLevel}
                            onChange={e => setPasscodeForm(p => ({ ...p, classLevel: e.target.value }))}
                            placeholder="e.g. JSS 2"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Unlock Passcode</label>
                          <div className="flex gap-2">
                            <input
                              required
                              value={passcodeForm.passcode}
                              onChange={e => setPasscodeForm(p => ({ ...p, passcode: e.target.value.toUpperCase() }))}
                              placeholder="e.g. ROBOT-892"
                              className={inputClass}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const generated = `EXAM-${Math.floor(1000 + Math.random() * 9000)}`;
                                setPasscodeForm(p => ({ ...p, passcode: generated }));
                              }}
                              className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase hover:bg-slate-100"
                            >
                              Auto
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>Invigilator Name</label>
                          <input
                            value={passcodeForm.invigilatorName}
                            onChange={e => setPasscodeForm(p => ({ ...p, invigilatorName: e.target.value }))}
                            placeholder="e.g. Lead Instructor"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowPasscodeModal(false)}
                          className="min-h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingAction}
                          className="min-h-10 px-5 rounded-xl bg-brand-red text-white text-xs font-black inline-flex items-center gap-2"
                        >
                          {savingAction ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                          Create Passcode
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Passcodes Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                        <th className="py-3 px-3">Exam Title</th>
                        <th className="py-3 px-3">Subject / Level</th>
                        <th className="py-3 px-3">Passcode</th>
                        <th className="py-3 px-3">Invigilator</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {passcodes.length ? (
                        passcodes.map(p => (
                          <tr key={p.id}>
                            <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                              {p.examTitle}
                            </td>
                            <td className="py-3.5 px-3 text-slate-500">
                              {p.subject || 'STEM'} • {p.classLevel || 'All Levels'}
                            </td>
                            <td className="py-3.5 px-3 font-mono font-black text-brand-red">
                              <span className="bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-md">
                                {p.passcode}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400">
                              {p.invigilatorName || 'Assigned Staff'}
                            </td>
                            <td className="py-3.5 px-3">
                              <button
                                type="button"
                                onClick={() => handleTogglePasscode(p.id, p.isActive)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  p.isActive
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                }`}
                              >
                                {p.isActive ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(p.passcode, p.id)}
                                  className="min-h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold flex items-center gap-1"
                                >
                                  {copiedId === p.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                  {copiedId === p.id ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePasscode(p.id)}
                                  className="min-h-8 min-w-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No exam passcodes generated for {selectedSchool.name} yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: School Resources & Practical Links */}
          {activeSchoolTab === 'resources' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Curriculum Resources & External Practical Links</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Attach lab manuals, Google Drive kits, PDF curriculums, and CBT exam interfaces to this school.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResourceModal(true)}
                  className="min-h-11 px-4 rounded-xl bg-brand-red hover:bg-red-700 text-white font-black text-xs inline-flex items-center gap-2 shadow-sm transition-all"
                >
                  <Plus size={16} /> Add Resource Link
                </button>
              </div>

              {/* Resource Modal */}
              {showResourceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                  <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        Add Curriculum Resource Link
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowResourceModal(false)}
                        className="min-h-9 min-w-9 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleCreateResource} className="space-y-4">
                      <div>
                        <label className={labelClass}>Resource Title</label>
                        <input
                          required
                          value={resourceForm.title}
                          onChange={e => setResourceForm(r => ({ ...r, title: e.target.value }))}
                          placeholder="e.g. Primary 5 Robotics Lab Guide (Term 2)"
                          className={inputClass}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Category</label>
                          <select
                            value={resourceForm.category}
                            onChange={e => setResourceForm(r => ({ ...r, category: e.target.value }))}
                            className={inputClass}
                          >
                            <option value="Curriculum & Lab Manual">Curriculum & Lab Manual</option>
                            <option value="CBT Examination Link">CBT Examination Link</option>
                            <option value="Project Assessment Sheet">Project Assessment Sheet</option>
                            <option value="Tutor Lab Presentation">Tutor Lab Presentation</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>URL Link</label>
                          <input
                            required
                            type="url"
                            value={resourceForm.url}
                            onChange={e => setResourceForm(r => ({ ...r, url: e.target.value }))}
                            placeholder="https://drive.google.com/..."
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Resource Description</label>
                        <textarea
                          rows={2}
                          value={resourceForm.description}
                          onChange={e => setResourceForm(r => ({ ...r, description: e.target.value }))}
                          placeholder="Short instructional note for students and school staff..."
                          className={inputClass}
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowResourceModal(false)}
                          className="min-h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingAction}
                          className="min-h-10 px-5 rounded-xl bg-brand-red text-white text-xs font-black inline-flex items-center gap-2"
                        >
                          {savingAction ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                          Save Resource
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Resource Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.length ? (
                  resources.map(res => (
                    <div
                      key={res.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {res.category || 'Resource'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteResource(res.id)}
                            className="min-h-8 min-w-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <h3 className="font-black text-sm text-slate-900 dark:text-white mt-2">
                          {res.title}
                        </h3>
                        {res.description && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {res.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-black text-brand-red inline-flex items-center gap-1 hover:underline"
                        >
                          Open Resource <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-10 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                    No curriculum resources or exam links attached to this school yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: Enrolled Cadets Roster */}
          {activeSchoolTab === 'cadets' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Enrolled Cadets ({cadets.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Students enrolled under {selectedSchool.name}. These students do not see individual payment fees in their student portals.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                      <th className="py-3 px-3">Student Name</th>
                      <th className="py-3 px-3">Username / Identifier</th>
                      <th className="py-3 px-3">Class / Level</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {cadets.length ? (
                      cadets.map(c => (
                        <tr key={c.id}>
                          <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                            {c.fullName || c.studentName || 'Student Cadet'}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-slate-500">
                            {c.username || c.email || c.id}
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400">
                            {c.class || c.grade || 'Primary / Secondary'}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40">
                              Active Cadet
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No students currently enrolled in the roster for this school.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: Firestore Live Document Raw Data */}
          {activeSchoolTab === 'raw' && (
            <div className="bg-slate-950 text-slate-200 rounded-3xl p-6 border border-slate-800 font-mono text-xs overflow-x-auto shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <span className="text-emerald-400 font-bold">Firestore Document: schools/{selectedSchool.id}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(JSON.stringify(selectedSchool, null, 2), 'raw-json')}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-white flex items-center gap-1.5"
                >
                  {copiedId === 'raw-json' ? <Check size={12} /> : <Copy size={12} />}
                  Copy JSON
                </button>
              </div>
              <pre className="whitespace-pre-wrap leading-relaxed text-[11px]">
                {JSON.stringify(selectedSchool, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        /* View 2: Clean School Directory List View */
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Stats */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                  Partner Schools
                </h1>
                <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl">
                  Click any affiliated school to manage its undergoing programmes, custom billing fees, payment plans, passcodes, and student roster.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void loadSchools()}
                  className="min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-all"
                >
                  <RefreshCw size={14} /> Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(true)}
                  className="min-h-11 px-5 rounded-xl bg-brand-red hover:bg-red-700 text-white font-black text-xs inline-flex items-center gap-2 shadow-sm transition-all"
                >
                  <Plus size={16} /> Onboard New School
                </button>
              </div>
            </div>

            {/* Metric counters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 text-xs block">Total Partner Schools</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                  {totalSchoolsCount}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 text-xs block">Active Institutional Labs</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">
                  {activeSchoolsCount}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 text-xs block">Total Undergoing Programmes</span>
                <span className="text-2xl font-black text-brand-red mt-1 block">
                  {totalProgramsCount}
                </span>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-sm">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search partner schools by name, code, administrator email, or state..."
              className="w-full bg-transparent text-xs font-medium focus:outline-none text-slate-900 dark:text-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* List of Schools */}
          {loading ? (
            <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={18} /> Loading affiliated schools directory...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSchools.map(school => {
                const programsCount = school.programs?.length || 0;
                const feeAmount = school.billing?.baseAmount;
                const feeCycle = school.billing?.cycle || 'termly';
                const feeMode = school.billing?.mode?.replace('_', ' ') || 'advance termly';

                return (
                  <div
                    key={school.id}
                    onClick={() => setSelectedSchoolId(school.id)}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand-red/50 dark:hover:border-brand-red/50 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-10 min-h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-brand-red flex items-center justify-center text-lg">
                          {school.icon || <School size={20} />}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          school.status === 'SUSPENDED'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}>
                          {school.status || 'ACTIVE'}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 dark:text-white mt-3 group-hover:text-brand-red transition-colors">
                        {school.name}
                      </h3>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="font-mono font-bold text-brand-red">
                          {school.schoolCode || school.id.toUpperCase()}
                        </span>
                        <span>•</span>
                        <span>{school.state || 'Lagos'}</span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 line-clamp-1">
                        Admin: {school.contactEmail || school.email || 'No email set'}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span>Undergoing Programmes:</span>
                        <strong className="text-brand-red">{programsCount} Active</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span>Configured Fee:</span>
                        <strong className="font-black text-slate-900 dark:text-white capitalize">
                          {feeAmount ? `${formatNaira(feeAmount)} / ${feeCycle} (${feeMode})` : 'Default Plan'}
                        </strong>
                      </div>

                      <div className="pt-2 flex items-center justify-end text-xs font-black text-brand-red group-hover:translate-x-1 transition-transform">
                        Manage School Workspace <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Onboard School Modal */}
          {showOnboardModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Onboard New Partner School</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Register a new institution, assign its initial programme, and set billing.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    className="min-h-9 min-w-9 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleOnboardSchool} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>School Name</label>
                      <input
                        required
                        value={onboardForm.name}
                        onChange={e => setOnboardForm(o => ({ ...o, name: e.target.value }))}
                        placeholder="e.g. Apex International School"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>School Code (Optional)</label>
                      <input
                        value={onboardForm.schoolCode}
                        onChange={e => setOnboardForm(o => ({ ...o, schoolCode: e.target.value.toUpperCase() }))}
                        placeholder="e.g. APEX-2026"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Coordinator / Admin Name</label>
                      <input
                        value={onboardForm.contactName}
                        onChange={e => setOnboardForm(o => ({ ...o, contactName: e.target.value }))}
                        placeholder="e.g. Mrs. Adeleke"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Admin Email</label>
                      <input
                        type="email"
                        required
                        value={onboardForm.contactEmail}
                        onChange={e => setOnboardForm(o => ({ ...o, contactEmail: e.target.value }))}
                        placeholder="admin@apexschool.com"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input
                        value={onboardForm.phone}
                        onChange={e => setOnboardForm(o => ({ ...o, phone: e.target.value }))}
                        placeholder="+234..."
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>State</label>
                      <input
                        value={onboardForm.state}
                        onChange={e => setOnboardForm(o => ({ ...o, state: e.target.value }))}
                        placeholder="Lagos"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Initial Programme & Description
                    </h3>
                    <div>
                      <label className={labelClass}>Programme Title</label>
                      <input
                        value={onboardForm.initialProgramName}
                        onChange={e => setOnboardForm(o => ({ ...o, initialProgramName: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Curriculum Scope & Description</label>
                      <textarea
                        rows={2}
                        value={onboardForm.initialProgramDesc}
                        onChange={e => setOnboardForm(o => ({ ...o, initialProgramDesc: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Fee Amount (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={onboardForm.initialFee}
                        onChange={e => setOnboardForm(o => ({ ...o, initialFee: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Billing Frequency</label>
                      <select
                        value={onboardForm.cycle}
                        onChange={e => setOnboardForm(o => ({ ...o, cycle: e.target.value as any }))}
                        className={inputClass}
                      >
                        <option value="termly">Termly (12 Weeks)</option>
                        <option value="monthly">Monthly (4 Weeks)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Payment Mode</label>
                      <select
                        value={onboardForm.mode}
                        onChange={e => setOnboardForm(o => ({ ...o, mode: e.target.value as any }))}
                        className={inputClass}
                      >
                        <option value="advance_termly">Advance Termly</option>
                        <option value="advance_monthly">Advance Monthly</option>
                        <option value="post_termly">Post Termly</option>
                        <option value="post_monthly">Post Monthly</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowOnboardModal(false)}
                      className="min-h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={onboardingSaving}
                      className="min-h-11 px-6 rounded-xl bg-brand-red text-white text-xs font-black inline-flex items-center gap-2 shadow-sm"
                    >
                      {onboardingSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                      Onboard School
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSchools;
