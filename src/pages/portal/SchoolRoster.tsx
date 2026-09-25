import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertCircle, 
  GraduationCap, 
  Loader2, 
  Plus, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  UserRound, 
  UserX, 
  UserCheck, 
  ChevronRight, 
  Users, 
  KeyRound, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  X,
  Sparkles
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, query as fsQuery, where } from 'firebase/firestore';
import jsPDF from 'jspdf';
import SEO from '../../components/ui/SEO';
import { auth, db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { getEffectiveAuth } from '../../utils/impersonation';

type Student = { 
  id: string; 
  collection: string; 
  fullName: string; 
  username: string; 
  email: string | null; 
  class: string; 
  track: string; 
  parentId: string | null; 
  tutorId: string | null; 
  staffId: string | null; 
  portalAccessEnabled: boolean; 
  accountStatus: string; 
  source: string; 
};

type IssuedCredential = {
  studentId: string;
  studentName: string;
  username: string;
  accessCode: string;
  portal: string;
};

const SchoolRoster: React.FC = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClass, setSelectedClass] = useState('All Classes');
  
  // Credential issuance state
  const [issuingStudent, setIssuingStudent] = useState<Student | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [revealedCredential, setRevealedCredential] = useState<IssuedCredential | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (silent = false) => {
    const effective = getEffectiveAuth();
    if (!auth.currentUser && !effective.isMasquerading) {
      setLoading(false);
      return;
    } 
    if (silent) setRefreshing(true);
    else setLoading(true); 

    try {
      let roster: Student[] = [];
      const sId = effective.effectiveSchoolId || sessionStorage.getItem('schoolId') || (effective.effectiveRole === 'school' ? effective.effectiveUid : '');
      
      if (!effective.isMasquerading && auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken(true);
          const response = await fetch('/.netlify/functions/school-students', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const result = await response.json().catch(() => ({}));
          if (response.ok && Array.isArray(result.students)) {
            roster = result.students;
            if (result.schoolName) {
              sessionStorage.setItem('schoolName', result.schoolName);
            }
          } else {
            throw new Error(result.error || 'Endpoint unavailable');
          }
        } catch {
          // Proceed to Firestore fallback
        }
      }

      if (roster.length === 0) {
        // Direct client-side Firestore query for the school
        let targetSchoolId = sId;
        if (!targetSchoolId && effective.effectiveUid) {
          const uSnap = await getDoc(doc(db, 'users', effective.effectiveUid)).catch(() => null);
          const uData = uSnap?.data() || {};
          targetSchoolId = uData.schoolId || '';
        }

        if (targetSchoolId) {
          const [sSnap, iSnap] = await Promise.all([
            getDocs(fsQuery(collection(db, 'students'), where('schoolId', '==', targetSchoolId))).catch(() => ({ docs: [] })),
            getDocs(fsQuery(collection(db, 'individualStudents'), where('schoolId', '==', targetSchoolId))).catch(() => ({ docs: [] }))
          ]);
          const list: Student[] = [];
          sSnap.docs.forEach((d: any) => {
            const data = d.data();
            list.push({
              id: d.id,
              collection: 'students',
              fullName: data.fullName || data.name || 'Student',
              username: data.username || d.id,
              email: data.email || null,
              class: data.class || data.grade || 'General',
              track: data.track || 'Coding & Tech',
              parentId: data.parentId || null,
              tutorId: data.tutorId || null,
              staffId: data.staffId || null,
              portalAccessEnabled: data.portalAccessEnabled !== false,
              accountStatus: data.accountStatus || 'ACTIVE',
              source: 'school_portal'
            });
          });
          iSnap.docs.forEach((d: any) => {
            const data = d.data();
            if (!list.some(item => item.id === d.id)) {
              list.push({
                id: d.id,
                collection: 'individualStudents',
                fullName: data.fullName || data.studentName || data.name || 'Student',
                username: data.username || d.id,
                email: data.email || null,
                class: data.class || data.grade || 'General',
                track: data.track || 'Coding & Tech',
                parentId: data.parentId || null,
                tutorId: data.tutorId || null,
                staffId: data.staffId || null,
                portalAccessEnabled: data.portalAccessEnabled !== false,
                accountStatus: data.accountStatus || 'ACTIVE',
                source: 'individualStudents'
              });
            }
          });
          roster = list;
        }
      }
      setStudents(roster);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load roster.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  const updateAccess = async (student: Student, action: 'disable' | 'enable') => {
    try {
      if (!auth.currentUser) throw new Error('Your school session has expired.');
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch('/.netlify/functions/school-student-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: student.id, action })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to update portal access.');
      toast.success(action === 'disable' ? 'Student portal access restricted.' : 'Student portal access restored.');
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update portal access.');
    }
  };

  const handleIssueCredentials = async (student: Student) => {
    setIssuingStudent(student);
    setIsIssuing(true);
    try {
      if (!auth.currentUser) throw new Error('Your session has expired. Please sign in again.');
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch('/.netlify/functions/student-credential-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: student.id })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to issue credentials.');
      
      const cred = {
        studentId: student.id,
        studentName: student.fullName || 'Student',
        username: result.credentials?.username || student.username,
        accessCode: result.credentials?.accessCode || '',
        portal: `${window.location.origin}/portal`
      };
      setRevealedCredential(cred);
      toast.success(`Access code generated for ${student.fullName}. Copy or download it now.`);
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate access credentials.');
    } finally {
      setIsIssuing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Access code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const exportTxt = (cred: IssuedCredential) => {
    const text = `====================================
JAYSTARBLISS STUDIOS
STUDENT PORTAL ACCESS PACK
====================================

Student Name: ${cred.studentName}
Portal Username: ${cred.username}
Access Code: ${cred.accessCode}
Login Portal: ${cred.portal}

Important Security Notice:
- Keep this access code secure.
- Use the username and access code to log in at ${cred.portal}
- Issued on: ${new Date().toLocaleString()}
====================================`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${cred.studentName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-access-credentials.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = (cred: IssuedCredential) => {
    const pdf = new jsPDF();
    pdf.setFillColor(239, 68, 68);
    pdf.rect(0, 0, 210, 24, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('JAYSTARBLISS STUDIOS', 20, 16);
    
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(18);
    pdf.text('Student Portal Access Pass', 20, 45);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text('Official student authentication credential for the Jaystarbliss Learning Portal.', 20, 54);
    
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(20, 64, 170, 75, 4, 4, 'FD');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    pdf.text('STUDENT NAME:', 30, 80);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(15, 23, 42);
    pdf.text(cred.studentName, 75, 80);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.text('PORTAL USERNAME:', 30, 95);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(15, 23, 42);
    pdf.text(cred.username, 75, 95);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(239, 68, 68);
    pdf.text('ACCESS CODE:', 30, 110);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(220, 38, 38);
    pdf.text(cred.accessCode, 75, 110);
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.text('LOGIN URL:', 30, 125);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(37, 99, 235);
    pdf.text(cred.portal, 75, 125);
    
    pdf.setFontSize(9);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Generated on ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}. Keep this document secure.`, 20, 155);
    
    pdf.save(`${cred.studentName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-access-pass.pdf`);
  };

  useEffect(() => { void load(); }, [load]);

  const classGroups = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach(s => {
      const key = s.class || 'Not Assigned';
      map.set(key, (map.get(key) || 0) + 1);
    });
    const ordered = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'JSS 1', 'JSS 2', 'JSS 3', 'SS1', 'SS2', 'SS3'];
    return [...map.entries()].sort((a, b) => {
      const ia = ordered.indexOf(a[0]), ib = ordered.indexOf(b[0]);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [students]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return students.filter(student => 
      (selectedClass === 'All Classes' || String(student.class || 'Not Assigned') === selectedClass) &&
      (!term || [student.fullName, student.username, student.email, student.class, student.track].some(value => 
        String(value || '').toLowerCase().includes(term)
      ))
    );
  }, [students, query, selectedClass]);

  return (
    <div className="space-y-6">
      <SEO title="Students Roster & Credentials | Jaystarbliss Studios" description="Secure school learner roster and portal access management." noindex />
      
      {/* Header Banner */}
      <div className="pro-surface rounded-3xl p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-brand-red/10 p-3 text-brand-red">
              <GraduationCap size={24}/>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-black text-brand-red">School Operations</div>
              <h1 className="text-2xl md:text-3xl font-black mt-1">Students Roster & Credentials</h1>
              <p className="text-sm text-slate-500 mt-2 max-w-2xl">
                View enrolled learners, assign learning tracks, and issue or rotate secure portal access credentials directly to students.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              type="button" 
              onClick={() => void load(true)} 
              disabled={loading || refreshing} 
              className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-xs font-black inline-flex items-center gap-2 disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={15} className="animate-spin"/> : <RefreshCw size={15}/>} Refresh
            </button>
            <Link 
              to="/portal/school/onboard-student" 
              className="min-h-11 rounded-xl bg-brand-red text-white px-4 text-xs font-black inline-flex items-center gap-2 shadow-xs"
            >
              <Plus size={16}/> Onboard Student
            </Link>
          </div>
        </div>
      </div>

      {/* Class Group Filters */}
      <div className="pro-surface rounded-2xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-brand-red"/>
          <h2 className="text-sm font-black">Filter by Class Level</h2>
          <span className="text-xs text-slate-500">({students.length} total students)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            type="button" 
            onClick={() => setSelectedClass("All Classes")} 
            className={`min-h-9 rounded-xl px-3 text-xs font-black border transition-all ${
              selectedClass === "All Classes" 
                ? "bg-brand-red text-white border-brand-red shadow-xs" 
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
            }`}
          >
            All Classes ({students.length})
          </button>
          {classGroups.map(([name, count]) => (
            <button 
              type="button" 
              key={name} 
              onClick={() => setSelectedClass(name)} 
              className={`min-h-9 rounded-xl px-3 text-xs font-black border inline-flex items-center gap-1 transition-all ${
                selectedClass === name 
                  ? "bg-brand-red text-white border-brand-red shadow-xs" 
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
              }`}
            >
              {name} ({count})<ChevronRight size={12}/>
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="pro-surface rounded-2xl p-4 md:p-5">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              placeholder="Search by student name, username, class or track..." 
              className="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 pl-10 pr-3 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </div>
          <div className="text-xs font-bold text-slate-500">
            Showing {filtered.length} of {students.length} students
          </div>
        </div>
      </div>

      {/* Main Student List / Table */}
      {loading ? (
        <div className="pro-surface rounded-2xl p-12 flex items-center justify-center gap-3 text-sm text-slate-500">
          <Loader2 className="animate-spin text-brand-red" size={22}/> Loading students roster…
        </div>
      ) : students.length === 0 ? (
        <div className="pro-surface rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <UserRound size={30}/>
          </div>
          <h2 className="font-black text-lg mt-4">No students enrolled yet</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Start by onboarding the first student into your school's portal roster.
          </p>
          <Link 
            to="/portal/school/onboard-student" 
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-5 text-xs font-black text-white shadow-xs"
          >
            <Plus size={16}/> Onboard First Student
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="pro-surface rounded-2xl p-12 text-center">
          <Search size={28} className="mx-auto text-slate-400"/>
          <h2 className="font-black mt-3">No matching students found</h2>
          <p className="text-sm text-slate-500 mt-1">Try searching with a different keyword or select another class.</p>
        </div>
      ) : (
        <div className="pro-surface rounded-2xl overflow-hidden shadow-xs">
          <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_1.6fr] gap-4 px-5 py-3.5 border-b border-slate-200/70 dark:border-slate-800 text-[11px] uppercase tracking-widest font-black text-slate-500">
            <span>Student & Account</span>
            <span>Class Level</span>
            <span>Learning Track</span>
            <span>Portal Status</span>
            <span className="text-right">Credential & Actions</span>
          </div>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
            {filtered.map(student => (
              <div 
                key={`${student.collection}-${student.id}`} 
                className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_1.6fr] gap-3 md:gap-4 px-5 py-4 items-center hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
              >
                {/* Student Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-sm">
                    {student.fullName ? student.fullName.charAt(0).toUpperCase() : <UserRound size={18}/>}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-sm truncate text-slate-900 dark:text-white">
                      {student.fullName || 'Unnamed Student'}
                    </div>
                    <div className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-brand-red">@{student.username || 'pending'}</span>
                      {student.email && <span>• {student.email}</span>}
                    </div>
                  </div>
                </div>

                {/* Class */}
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  <span className="md:hidden text-[10px] uppercase text-slate-400 mr-2 font-normal">Class:</span>
                  {student.class || 'Not assigned'}
                </div>

                {/* Track */}
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="md:hidden text-[10px] uppercase text-slate-400 mr-2 font-normal">Track:</span>
                  {student.track || 'General Tech'}
                </div>

                {/* Status */}
                <div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${
                    student.portalAccessEnabled && student.accountStatus.toUpperCase() === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                  }`}>
                    <ShieldCheck size={13}/>
                    {student.portalAccessEnabled && student.accountStatus.toUpperCase() === 'ACTIVE' ? 'Active' : 'Restricted'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-start md:justify-end gap-2 flex-wrap">
                  <button 
                    type="button" 
                    onClick={() => void handleIssueCredentials(student)} 
                    disabled={isIssuing && issuingStudent?.id === student.id}
                    className="min-h-9 rounded-xl bg-brand-red text-white px-3 text-xs font-black inline-flex items-center gap-1.5 shadow-xs hover:bg-brand-red/90 disabled:opacity-50"
                    title="Generate and issue new login access code"
                  >
                    {isIssuing && issuingStudent?.id === student.id ? (
                      <Loader2 size={13} className="animate-spin"/>
                    ) : (
                      <KeyRound size={13}/>
                    )}
                    Issue Credentials
                  </button>

                  <button 
                    type="button" 
                    onClick={() => void updateAccess(student, student.portalAccessEnabled ? 'disable' : 'enable')} 
                    className={`min-h-9 rounded-xl border px-2.5 text-xs font-black inline-flex items-center gap-1 transition-colors ${
                      student.portalAccessEnabled && student.accountStatus.toUpperCase() === 'ACTIVE'
                        ? 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/30'
                    }`}
                  >
                    {student.portalAccessEnabled && student.accountStatus.toUpperCase() === 'ACTIVE' ? (
                      <><UserX size={13}/> Disable</>
                    ) : (
                      <><UserCheck size={13}/> Enable</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credential Modal Popup */}
      {revealedCredential && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#161B26] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-brand-red text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <KeyRound size={22} className="text-white"/>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/80">Security Credential</div>
                  <h3 className="text-lg font-black">{revealedCredential.studentName}</h3>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setRevealedCredential(null)} 
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
              >
                <X size={18}/>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-3">
                <Sparkles size={18} className="text-amber-600 shrink-0 mt-0.5"/>
                <div>
                  <strong>Write-Once Access Code:</strong> This fresh access code has been securely hashed and stored. Provide these credentials to the student now; the code is not visible again after closing this window.
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Portal Username</div>
                  <div className="font-mono text-sm font-bold text-slate-900 dark:text-white mt-0.5 select-all">
                    {revealedCredential.username}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fresh Access Code</div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <span className="font-mono text-xl font-black text-brand-red tracking-wider select-all">
                      {revealedCredential.accessCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(revealedCredential.accessCode)}
                      className="min-h-9 px-3 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-800"
                    >
                      {copied ? <Check size={14} className="text-emerald-400"/> : <Copy size={14}/>}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Login Portal URL</div>
                  <div className="font-mono text-xs text-blue-600 dark:text-blue-400 mt-0.5 select-all">
                    {revealedCredential.portal}
                  </div>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => exportPdf(revealedCredential)}
                  className="flex-1 min-h-11 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-4 text-xs font-black inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <FileText size={15}/> Download PDF Pass
                </button>
                <button
                  type="button"
                  onClick={() => exportTxt(revealedCredential)}
                  className="flex-1 min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-xs font-black inline-flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  <Download size={15}/> Download TXT File
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setRevealedCredential(null)}
                className="min-h-10 px-5 rounded-xl bg-brand-red text-white text-xs font-black hover:bg-brand-red/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Notice */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B26] p-5 text-xs text-slate-500 flex items-start gap-3">
        <AlertCircle size={18} className="shrink-0 mt-0.5 text-brand-red"/>
        <div>
          <strong className="text-slate-700 dark:text-slate-300">Institutional Credential Governance:</strong> When a student credential is re-issued or rotated, any previous access code is automatically invalidated. The student can also change their password independently once logged into their student portal.
        </div>
      </div>
    </div>
  );
};

export default SchoolRoster;
