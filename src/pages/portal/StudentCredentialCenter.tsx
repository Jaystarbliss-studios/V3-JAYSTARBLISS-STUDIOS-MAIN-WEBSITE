import React, { useEffect, useMemo, useState } from 'react';
import { 
  Download, FileText, KeyRound, Loader2, RefreshCw, 
  ShieldCheck, Users, ChevronRight, Search, Check, Copy,
  School, GraduationCap, Sparkles, AlertCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import { billingGet, billingPost } from '../../lib/billing';
import { useToast } from '../../contexts/ToastContext';
import SEO from '../../components/ui/SEO';
import { auth, db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

type Props = { role: 'staff' | 'school' };
type Student = { 
  id: string; 
  fullName?: string; 
  studentName?: string; 
  name?: string;
  username?: string; 
  class?: string; 
  classLevel?: string;
  grade?: string; 
  schoolName?: string;
  schoolId?: string;
  track?: string;
  programName?: string;
  portalAccessEnabled?: boolean;
  accountStatus?: string;
};

const StudentCredentialCenter: React.FC<Props> = ({ role }) => {
  const { toast } = useToast();
  const isSchool = role === 'school';
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issued, setIssued] = useState<Record<string, { username: string; accessCode: string; portal: string }>>({});
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const combinedMap = new Map<string, Student>();

    try {
      // 1. Fetch from billing-data
      try {
        const data = await billingGet<any>('billing-data');
        const list = (data?.students || []) as Student[];
        list.forEach(s => {
          if (s && s.id) combinedMap.set(s.id, s);
        });
      } catch (err) {
        console.warn('billing-data fetch in CredentialCenter:', err);
      }

      // 2. Fetch from school-students endpoint if school role or context
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const schoolParam = sessionStorage.getItem('schoolId') || localStorage.getItem('jaystar_cached_school_id') || '';
          const url = '/.netlify/functions/school-students' + (schoolParam ? `?schoolId=${encodeURIComponent(schoolParam)}` : '');
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const resJson = await res.json();
          if (res.ok && Array.isArray(resJson?.students)) {
            resJson.students.forEach((s: any) => {
              if (s && s.id) {
                const existing = combinedMap.get(s.id);
                combinedMap.set(s.id, {
                  ...(existing || {}),
                  id: s.id,
                  fullName: s.fullName || s.studentName || s.name || existing?.fullName,
                  studentName: s.fullName || s.studentName || s.name || existing?.studentName,
                  username: s.username || existing?.username,
                  class: s.class || s.classLevel || s.grade || existing?.class,
                  schoolName: s.schoolName || existing?.schoolName,
                  schoolId: s.schoolId || existing?.schoolId,
                  track: s.track || existing?.track,
                  portalAccessEnabled: s.portalAccessEnabled !== false
                });
              }
            });
          }
        } catch (err) {
          console.warn('school-students fetch in CredentialCenter:', err);
        }

        // 3. Direct Firestore Fallback if list is still small or empty
        if (combinedMap.size === 0) {
          try {
            const schoolId = sessionStorage.getItem('schoolId') || localStorage.getItem('jaystar_cached_school_id') || currentUser.uid;
            const queries = [
              query(collection(db, 'individualStudents'), where('schoolId', '==', schoolId)),
              query(collection(db, 'students'), where('schoolId', '==', schoolId)),
              query(collection(db, 'users'), where('schoolId', '==', schoolId))
            ];
            const snapshots = await Promise.all(queries.map(q => getDocs(q).catch(() => null)));
            snapshots.forEach(snap => {
              if (!snap) return;
              snap.docs.forEach(d => {
                const data = d.data();
                const key = String(data.studentDocId || d.id);
                if (!combinedMap.has(key)) {
                  combinedMap.set(key, {
                    id: key,
                    fullName: data.fullName || data.studentName || data.name || 'Student',
                    studentName: data.fullName || data.studentName || data.name || 'Student',
                    username: data.username || key,
                    class: data.class || data.classLevel || data.grade || 'General',
                    schoolName: data.schoolName || '',
                    schoolId: data.schoolId || schoolId,
                    track: data.track || 'General Tech',
                    portalAccessEnabled: data.portalAccessEnabled !== false,
                    accountStatus: data.accountStatus || 'ACTIVE'
                  });
                }
              });
            });
          } catch (fsErr) {
            console.warn('Direct Firestore fallback:', fsErr);
          }
        }
      }

      setStudents(Array.from(combinedMap.values()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const classGroups = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach(student => {
      const key = student.class || student.classLevel || student.grade || 'Not Assigned';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [students]);

  const visibleStudents = useMemo(() => {
    return students.filter(student => {
      const studentClass = student.class || student.classLevel || student.grade || 'Not Assigned';
      if (selectedClass !== 'All Classes' && studentClass !== selectedClass) {
        return false;
      }
      if (searchTerm.trim()) {
        const queryStr = searchTerm.toLowerCase();
        const name = String(student.fullName || student.studentName || student.name || '').toLowerCase();
        const user = String(student.username || '').toLowerCase();
        const cl = String(studentClass).toLowerCase();
        const tr = String(student.track || '').toLowerCase();
        if (!name.includes(queryStr) && !user.includes(queryStr) && !cl.includes(queryStr) && !tr.includes(queryStr)) {
          return false;
        }
      }
      return true;
    });
  }, [students, selectedClass, searchTerm]);

  const issue = async (student: Student) => {
    setBusyId(student.id);
    try {
      const result = await billingPost<any>('student-credential-issue', { studentId: student.id });
      setIssued(prev => ({ ...prev, [student.id]: result.credentials }));
      toast.success(`New access code issued for ${student.fullName || student.studentName || 'student'}. Save it now; it will not be shown again.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to issue credentials.');
    } finally {
      setBusyId(null);
    }
  };

  const copyCredential = (student: Student) => {
    const credentials = issued[student.id];
    if (!credentials) return;
    const name = String(student.fullName || student.studentName || 'Student');
    const text = `JAYSTARBLISS STUDIOS PORTAL ACCESS\nStudent: ${name}\nUsername: ${credentials.username}\nAccess Code: ${credentials.accessCode}\nLogin URL: ${window.location.origin}/portal`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(student.id);
      toast.success('Credentials copied to clipboard.');
      setTimeout(() => setCopiedId(null), 2500);
    }).catch(() => {
      toast.error('Could not copy to clipboard.');
    });
  };

  const exportPack = (student: Student) => {
    const credentials = issued[student.id];
    if (!credentials) {
      toast.error('Issue a fresh access code before exporting the access pack.');
      return;
    }
    const name = String(student.fullName || student.studentName || 'Student');
    const text = `========================================\nJAYSTARBLISS STUDIOS — STUDENT ACCESS PACK\n========================================\n\nStudent Name: ${name}\nClass: ${student.class || student.classLevel || student.grade || 'General'}\nSchool: ${student.schoolName || 'Partner School'}\n\nPORTAL LOGIN CREDENTIALS:\n-------------------------\nUsername:    ${credentials.username}\nAccess Code: ${credentials.accessCode}\nLogin Portal: ${window.location.origin}/portal\n\n* Keep these credentials private and confidential.\n* Issued on: ${new Date().toLocaleDateString('en-NG', { dateStyle: 'full' })}\n========================================`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-student-access.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = (student: Student) => {
    const credentials = issued[student.id];
    if (!credentials) {
      toast.error('Issue a fresh access code before exporting the access pack.');
      return;
    }
    const name = String(student.fullName || student.studentName || 'Student');
    const studentClass = String(student.class || student.classLevel || student.grade || 'General');
    const pdf = new jsPDF();
    
    // Header styling
    pdf.setFillColor(185, 28, 28);
    pdf.rect(0, 0, 210, 26, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('JAYSTARBLISS STUDIOS', 20, 16);
    
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(14);
    pdf.text('Official Student Access Pass', 20, 38);
    
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(20, 46, 170, 70, 4, 4, 'FD');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text('STUDENT FULL NAME', 28, 58);
    pdf.text('CLASS / LEVEL', 115, 58);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(name, 28, 66);
    pdf.text(studentClass, 115, 66);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text('PORTAL USERNAME', 28, 82);
    pdf.text('ACCESS PASSCODE', 115, 82);
    
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(185, 28, 28);
    pdf.text(credentials.username, 28, 90);
    pdf.text(credentials.accessCode, 115, 90);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Portal URL: ${window.location.origin}/portal`, 28, 106);
    
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8.5);
    pdf.text('Keep this document safe and strictly confidential. Do not share credentials.', 20, 126);
    pdf.text(`Generated on ${new Date().toLocaleDateString('en-NG', { dateStyle: 'full' })}`, 20, 132);
    
    pdf.save(`${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-access-pass.pdf`);
  };

  return (
    <section className="space-y-6" aria-label="Student credential center">
      <SEO 
        title="Student Access Packs | Jaystarbliss Studios" 
        description="Securely issue and export student portal credentials." 
        noindex={true}
      />

      {/* Header Banner */}
      <div className="pro-surface rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-red">
              <KeyRound size={14} /> Student Access Packs & Credentials
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
              Issue & Manage Student Credentials
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Generate write-once secure passcodes and access packs for your enrolled students. Credentials can be rotated anytime access needs to be refreshed.
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => void load()} 
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Policy banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
        <span>
          <strong>Zero-Knowledge Security:</strong> {isSchool ? 'School' : 'Staff'} student passcodes are securely hashed. When you click <em>Issue / Rotate Code</em>, the new access code is displayed for this session so you can print or export the access pack immediately.
        </span>
      </div>

      {/* Controls & Filter bar */}
      <div className="pro-surface rounded-2xl p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              placeholder="Search student by name, username, or class…" 
              className="w-full min-h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
            <GraduationCap size={15} className="text-brand-red" />
            <span>{visibleStudents.length} of {students.length} Student{students.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        {/* Class Filter Tabs */}
        {classGroups.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button 
                type="button" 
                onClick={() => setSelectedClass('All Classes')} 
                className={`min-h-8 px-3 rounded-lg font-bold whitespace-nowrap transition ${
                  selectedClass === 'All Classes' 
                    ? 'bg-brand-red text-white' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All Classes ({students.length})
              </button>
              {classGroups.map(([cls, count]) => (
                <button 
                  key={cls} 
                  type="button" 
                  onClick={() => setSelectedClass(cls)} 
                  className={`min-h-8 px-3 rounded-lg font-bold whitespace-nowrap transition flex items-center gap-1 ${
                    selectedClass === cls 
                      ? 'bg-brand-red text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cls} <span className="text-[10px] opacity-75">({count})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Student Cards Grid */}
      {loading ? (
        <div className="pro-surface rounded-2xl p-16 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-brand-red" />
          <span>Loading student directory and access records…</span>
        </div>
      ) : students.length === 0 ? (
        <div className="pro-surface rounded-2xl p-12 text-center">
          <AlertCircle size={36} className="mx-auto text-amber-500 mb-3" />
          <h3 className="font-black text-lg text-slate-900 dark:text-white">No students currently enrolled</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Enrolled learners will automatically appear here once onboarded or added to the institutional roster.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button 
              type="button" 
              onClick={() => void load()} 
              className="min-h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Refresh Roster
            </button>
          </div>
        </div>
      ) : visibleStudents.length === 0 ? (
        <div className="pro-surface rounded-2xl p-10 text-center text-sm text-slate-500">
          No students match the selected filter <strong>"{searchTerm || selectedClass}"</strong>.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleStudents.map(student => {
            const credential = issued[student.id];
            const name = student.fullName || student.studentName || student.name || 'Student';
            const studentClass = student.class || student.classLevel || student.grade || 'General';

            return (
              <article 
                key={student.id} 
                className="pro-surface rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 transition hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">{name}</h3>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {studentClass}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 font-mono">
                      @{student.username || 'username not issued'} {student.track ? `• ${student.track}` : ''}
                    </p>
                  </div>

                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                    student.portalAccessEnabled !== false 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' 
                      : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  }`}>
                    {student.portalAccessEnabled !== false ? 'Active' : 'Disabled'}
                  </span>
                </div>

                {/* Newly issued credential callout */}
                {credential ? (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/30 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-600" /> Fresh Credentials Issued
                      </span>
                      <button 
                        type="button" 
                        onClick={() => copyCredential(student)}
                        className="text-[11px] font-bold text-amber-900 dark:text-amber-200 inline-flex items-center gap-1 hover:underline"
                      >
                        {copiedId === student.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        {copiedId === student.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 font-mono text-xs">
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                        <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Username</span>
                        <strong className="text-slate-900 dark:text-white font-black">{credential.username}</strong>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                        <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Access Passcode</span>
                        <strong className="text-brand-red font-black tracking-wider">{credential.accessCode}</strong>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-300 leading-tight">
                      This write-once passcode is now active. Download or copy it now before leaving.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3 text-xs text-slate-500">
                    Click <strong>Issue / Rotate Code</strong> below to generate a new write-once passcode.
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button 
                    type="button" 
                    disabled={busyId === student.id} 
                    onClick={() => void issue(student)} 
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red hover:bg-red-700 px-4 text-xs font-black text-white transition disabled:opacity-50"
                  >
                    {busyId === student.id ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                    {credential ? 'Rotate Code' : 'Issue Credentials'}
                  </button>

                  <button 
                    type="button" 
                    disabled={!credential} 
                    onClick={() => copyCredential(student)} 
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copiedId === student.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    Copy
                  </button>

                  <button 
                    type="button" 
                    disabled={!credential} 
                    onClick={() => exportPack(student)} 
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download size={13} />
                    TXT
                  </button>

                  <button 
                    type="button" 
                    disabled={!credential} 
                    onClick={() => exportPdf(student)} 
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FileText size={13} />
                    PDF Pass
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default StudentCredentialCenter;
