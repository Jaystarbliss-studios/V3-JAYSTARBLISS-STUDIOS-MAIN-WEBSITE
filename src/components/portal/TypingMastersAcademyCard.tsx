import React, { useState, useEffect } from 'react';
import { 
  Keyboard, 
  ExternalLink, 
  CheckCircle2, 
  ArrowUpRight,
  BookOpen,
  Copy,
  Check,
  Lock,
  ClipboardList,
  Loader2,
  Calendar
} from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';

interface DynamicEdclubAssignment {
  id: string;
  title: string;
  module?: string;
  instructions?: string;
  dueDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SUBMITTED' | 'PUBLISHED';
  targetWpm?: number;
  accuracy?: string;
  wpm?: number | string;
  drillUrl?: string;
  tutorName?: string;
  createdAt?: string;
}

interface TypingMastersAcademyCardProps {
  studentName?: string;
  studentClass?: string;
  schoolId?: string;
  isAllowed?: boolean;
  enrolledProgramName?: string;
  onOpenEdClub?: () => void;
}

export const TypingMastersAcademyCard: React.FC<TypingMastersAcademyCardProps> = ({
  studentName = 'Student',
  studentClass,
  schoolId,
  isAllowed = true,
  enrolledProgramName = 'Digital Literacy Junior',
  onOpenEdClub
}) => {
  const [edclubUrl, setEdclubUrl] = useState('https://jaystarbliss-studios.edclub.com');
  const [bannerUrl, setBannerUrl] = useState('');
  const [cardTitle, setCardTitle] = useState('Keyboarding & Speed Typing Hub');
  const [cardSubtitle, setCardSubtitle] = useState('Touch Typing Foundations • Home Row, Punctuation & Speed Drills');
  const [copied, setCopied] = useState(false);
  const [dynamicAssignments, setDynamicAssignments] = useState<DynamicEdclubAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  // Fetch EdClub portal configurations
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docKey = schoolId ? `edclub_${schoolId}` : 'edclub';
        const snap = await getDoc(doc(db, 'settings', docKey));
        if (snap.exists()) {
          const data = snap.data();
          if (data.portalUrl) {
            setEdclubUrl(data.portalUrl === 'https://www.edclub.com' ? 'https://jaystarbliss-studios.edclub.com' : data.portalUrl);
          }
          if (data.bannerUrl) setBannerUrl(data.bannerUrl);
          if (data.title) setCardTitle(data.title);
          if (data.subtitle) setCardSubtitle(data.subtitle);
        } else if (schoolId) {
          const globalSnap = await getDoc(doc(db, 'settings', 'edclub'));
          if (globalSnap.exists()) {
            const data = globalSnap.data();
            if (data.portalUrl) {
              setEdclubUrl(data.portalUrl === 'https://www.edclub.com' ? 'https://jaystarbliss-studios.edclub.com' : data.portalUrl);
            }
            if (data.bannerUrl) setBannerUrl(data.bannerUrl);
            if (data.title) setCardTitle(data.title);
            if (data.subtitle) setCardSubtitle(data.subtitle);
          }
        }
      } catch (err) {
        console.warn('EdClub settings fetch failed:', err);
      }
    };
    fetchSettings();
  }, [schoolId]);

  // Dynamically load real EdClub assignments from Firestore
  useEffect(() => {
    let active = true;

    const loadEdclubAssignments = async () => {
      setLoadingAssignments(true);
      try {
        const currentUid = auth.currentUser?.uid || '';
        const studentDocId = sessionStorage.getItem('studentDocId') || '';
        const cachedSchoolId = schoolId || sessionStorage.getItem('studentSchoolId') || '';
        const cachedClass = (studentClass || sessionStorage.getItem('studentClass') || '').trim().toLowerCase();

        const assignmentsList: DynamicEdclubAssignment[] = [];
        const seenIds = new Set<string>();

        // 1. Query Firestore academicAssignments & assignments
        const fetchQueries = [
          getDocs(query(collection(db, 'assignments'), where('type', '==', 'edclub'))).catch(() => ({ docs: [] } as any)),
          getDocs(query(collection(db, 'academicAssignments'), where('type', '==', 'edclub'))).catch(() => ({ docs: [] } as any)),
          getDocs(query(collection(db, 'assignments'), where('category', '==', 'edclub'))).catch(() => ({ docs: [] } as any)),
          getDocs(query(collection(db, 'schoolResources'), where('docType', '==', 'Practical Worksheet'))).catch(() => ({ docs: [] } as any))
        ];

        if (studentDocId) {
          fetchQueries.push(
            getDocs(query(collection(db, 'assignments'), where('studentId', '==', studentDocId))).catch(() => ({ docs: [] } as any))
          );
        }

        const results = await Promise.all(fetchQueries);

        results.forEach((snap: any) => {
          if (!snap?.docs) return;
          snap.docs.forEach((d: any) => {
            if (seenIds.has(d.id)) return;
            const data = d.data();
            
            // Check if this assignment belongs to EdClub or typing
            const isEdclub = data.type === 'edclub' || 
              data.category === 'edclub' || 
              data.isEdclub === true ||
              String(data.title || '').toLowerCase().includes('typing') ||
              String(data.title || '').toLowerCase().includes('edclub') ||
              String(data.subject || '').toLowerCase().includes('typing');

            if (!isEdclub) return;

            // Check if matches student, school, or class
            let matches = false;
            if (data.studentId && (data.studentId === studentDocId || data.studentId === currentUid)) {
              matches = true;
            } else if (data.schoolId && cachedSchoolId && data.schoolId === cachedSchoolId) {
              if (cachedClass && Array.isArray(data.assignedClasses) && data.assignedClasses.length > 0) {
                matches = data.assignedClasses.some((c: string) => {
                  const lc = String(c).toLowerCase().trim();
                  return lc === 'all classes' || lc === 'all' || lc === cachedClass || cachedClass.includes(lc) || lc.includes(cachedClass);
                });
              } else {
                matches = true;
              }
            } else if (!data.studentId && !data.schoolId) {
              // General EdClub assignment
              matches = true;
            }

            if (matches) {
              seenIds.add(d.id);
              assignmentsList.push({
                id: d.id,
                title: data.title || 'Speed Typing Practical Drill',
                module: data.module || data.lessonNumber || (data.targetWpm ? `Target: ${data.targetWpm} WPM` : 'EdClub Module'),
                instructions: data.instructions || data.description || 'Complete this typing drill on your EdClub account.',
                dueDate: data.dueDate ? (new Date(data.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) : undefined,
                status: (data.status as any) || 'PUBLISHED',
                targetWpm: data.targetWpm,
                accuracy: data.accuracy || (data.targetAccuracy ? `${data.targetAccuracy}%` : undefined),
                wpm: data.wpm,
                drillUrl: data.drillUrl || data.url || data.resourceUrl || edclubUrl,
                tutorName: data.tutorName || data.assignedBy,
                createdAt: data.createdAt
              });
            }
          });
        });

        if (active) {
          setDynamicAssignments(assignmentsList);
        }
      } catch (err) {
        console.warn('Failed to load dynamic EdClub assignments:', err);
      } finally {
        if (active) setLoadingAssignments(false);
      }
    };

    void loadEdclubAssignments();
    return () => { active = false; };
  }, [studentClass, schoolId]);

  const handleLaunch = () => {
    if (onOpenEdClub) {
      onOpenEdClub();
    } else {
      window.open(edclubUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(edclubUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  // LOCKED STATE (WHEN NOT IN ENROLLED EDCLUB PROGRAM TRACK)
  if (!isAllowed) {
    return (
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900/80 dark:bg-slate-950/90 text-slate-400 border border-slate-800 shadow-md p-4 sm:p-6 space-y-3 filter grayscale-[30%]">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center shrink-0">
              <Lock size={18} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-slate-700">
                  <Lock size={10} className="text-amber-400" /> Locked Feature
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-200 mt-1 truncate">
                {cardTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Enrolled Track: <strong className="text-slate-300 font-semibold">{enrolledProgramName}</strong>
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              disabled
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-bold cursor-not-allowed border border-slate-700/60"
            >
              <Lock size={12} />
              <span>EdClub Not Included</span>
            </button>
          </div>
        </div>

        <div className="relative z-10 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
          <span className="text-amber-400 text-sm shrink-0">⚠️</span>
          <p className="leading-relaxed">
            This student account is currently enrolled in <strong>{enrolledProgramName}</strong>. EdClub typing lessons are enabled for programs configured with EdClub access. Contact your school administrator or Jaystarbliss tutor for details.
          </p>
        </div>
      </section>
    );
  }

  // ACTIVE UNLOCKED BANNER
  return (
    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-950 text-white border border-indigo-900/60 shadow-xl p-4 sm:p-6 lg:p-7 space-y-5">
      {/* Background Banner Image or Gradient (Clean Full Coverage without clipping) */}
      {bannerUrl ? (
        <>
          <img 
            src={bannerUrl} 
            alt="EdClub Banner" 
            className="absolute inset-0 w-full h-full object-cover object-center opacity-40 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-indigo-950/80 pointer-events-none" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c102b] via-[#101738] to-[#0a0f24] pointer-events-none" />
      )}

      {/* Ambient highlights */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Banner - Responsive on Mobile and Desktop */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-700/60 pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/40 border border-indigo-400/60 flex items-center justify-center text-white shadow-md shrink-0">
            <Keyboard size={24} className="text-white" />
          </div>
          <div className="min-w-0">
            <h3 style={{ color: '#ffffff' }} className="text-base sm:text-xl font-black !text-white tracking-tight leading-snug">
              {cardTitle}
            </h3>
            <p style={{ color: '#e0e7ff' }} className="text-xs !text-indigo-100 font-semibold mt-0.5 leading-normal">
              {cardSubtitle}
            </p>
            <p style={{ color: '#cbd5e1' }} className="text-[11px] !text-slate-200 mt-1 font-bold flex flex-wrap items-center gap-2">
              <span className="truncate max-w-[220px]">Roster: <strong className="text-white">{studentName}</strong></span>
              {studentClass && <span>• Class: <strong className="text-white">{studentClass}</strong></span>}
              {enrolledProgramName && <span className="text-indigo-300 font-bold">• {enrolledProgramName}</span>}
            </p>
          </div>
        </div>

        {/* Action Controls - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 md:pt-0">
          <div className="flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-indigo-400/50 text-white font-mono text-[11px] font-bold">
            <span className="truncate max-w-[180px] sm:max-w-[210px] text-indigo-100">{edclubUrl.replace('https://', '')}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy EdClub Portal Link"
              aria-label="Copy EdClub Portal Link"
              className="p-1 hover:text-white transition-colors cursor-pointer text-indigo-300"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleLaunch}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs sm:text-sm font-black transition-all shadow-md shadow-indigo-600/40 cursor-pointer shrink-0"
          >
            <ExternalLink size={14} className="text-white" />
            <span className="text-white">Launch EdClub</span>
            <ArrowUpRight size={13} className="opacity-90 text-white" />
          </button>
        </div>
      </div>

      {/* Dynamic EdClub Assignments List from Firestore */}
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white">
            <ClipboardList size={14} className="text-indigo-400" />
            <span style={{ color: '#ffffff' }} className="!text-white font-bold">EdClub Assigned Tasks ({dynamicAssignments.length})</span>
          </div>
          <span style={{ color: '#e2e8f0' }} className="text-[11px] font-bold !text-slate-200">
            Assigned by Tutor &amp; Academy
          </span>
        </div>

        {loadingAssignments ? (
          <div className="p-6 text-center text-xs text-white rounded-2xl bg-slate-900/90 border border-indigo-900/50 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-indigo-400" />
            <span className="text-white font-medium">Checking active EdClub assignments...</span>
          </div>
        ) : dynamicAssignments.length === 0 ? (
          <div className="p-5 text-center rounded-2xl bg-slate-900/90 border border-dashed border-indigo-700/60 space-y-2">
            <Keyboard size={24} className="mx-auto text-indigo-400" />
            <p style={{ color: '#ffffff' }} className="text-xs font-black !text-white">No pending EdClub typing tasks</p>
            <p style={{ color: '#cbd5e1' }} className="text-[11px] !text-slate-300 max-w-md mx-auto leading-relaxed">
              When your assigned tutor or administrator issues an EdClub typing drill, it will appear here in real time. You can launch EdClub anytime to practice your speed drills!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dynamicAssignments.map((item) => (
              <div 
                key={item.id}
                className="p-3.5 rounded-2xl bg-slate-900/95 border border-indigo-700/70 hover:border-indigo-400/80 transition-all flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      item.status === 'COMPLETED' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-indigo-600/30 text-indigo-200 border border-indigo-400/50'
                    }`}>
                      {item.status === 'COMPLETED' ? <CheckCircle2 size={16} /> : <BookOpen size={16} />}
                    </div>
                    <div className="min-w-0">
                      <h4 style={{ color: '#ffffff' }} className="text-xs sm:text-sm font-bold !text-white truncate">{item.title}</h4>
                      {item.instructions && (
                        <p style={{ color: '#cbd5e1' }} className="text-[11px] !text-slate-300 line-clamp-2 mt-0.5">{item.instructions}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-indigo-200 font-semibold">
                        {item.module && <span className="text-indigo-300">{item.module}</span>}
                        {item.dueDate && (
                          <span className="flex items-center gap-1 text-slate-200 font-medium">
                            <Calendar size={10} className="text-indigo-300" /> Due: {item.dueDate}
                          </span>
                        )}
                        {item.tutorName && <span className="text-slate-300">• By: {item.tutorName}</span>}
                      </div>
                    </div>
                  </div>

                  {item.targetWpm && (
                    <div className="text-right shrink-0 px-2 py-1 rounded-lg bg-indigo-950 border border-indigo-600/70">
                      <div className="text-xs font-black font-mono text-amber-300">{item.targetWpm} WPM</div>
                      <div style={{ color: '#cbd5e1' }} className="text-[9px] uppercase font-bold !text-slate-300">Target</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-1 border-t border-indigo-900/80">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.drillUrl && item.drillUrl !== edclubUrl) {
                        window.open(item.drillUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        handleLaunch();
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <span>Open Drill</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TypingMastersAcademyCard;
