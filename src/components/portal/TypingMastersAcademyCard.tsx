import React, { useState, useEffect } from 'react';
import { 
  Keyboard, 
  ExternalLink, 
  Trophy, 
  Target, 
  CheckCircle2, 
  Sparkles, 
  Flame, 
  ArrowUpRight,
  Clock,
  BookOpen,
  Award,
  ChevronRight,
  Copy,
  Check,
  Lock
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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
  enrolledProgramName = 'General Programme',
  onOpenEdClub
}) => {
  const [edclubUrl, setEdclubUrl] = useState('https://jaystarbliss-studios.edclub.com');
  const [bannerUrl, setBannerUrl] = useState('');
  const [cardTitle, setCardTitle] = useState('Keyboarding & Speed Typing Hub');
  const [cardSubtitle, setCardSubtitle] = useState('Touch Typing Foundations • Home Row & Punctuation');
  const [copied, setCopied] = useState(false);
  const [weeklyGoal, setWeeklyGoal] = useState({
    targetWpm: 30,
    targetLessons: 4,
    completedLessons: 3,
    targetAccuracy: 95,
    title: 'Touch Typing Foundations • Home Row & Punctuation'
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'milestones'>('overview');

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
          if (data.weeklyGoal) setWeeklyGoal(prev => ({ ...prev, ...data.weeklyGoal }));
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
            if (data.weeklyGoal) setWeeklyGoal(prev => ({ ...prev, ...data.weeklyGoal }));
          }
        }
      } catch (err) {
        console.warn('EdClub settings fetch failed:', err);
      }
    };
    fetchSettings();
  }, [schoolId]);

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

  const assignments = [
    {
      id: 'typing-1',
      title: 'Home Row Mastery (A S D F J K L ;)',
      module: 'Lesson 1-12',
      duration: '15 mins',
      due: 'This Friday',
      status: 'COMPLETED',
      accuracy: '98%',
      wpm: 28
    },
    {
      id: 'typing-2',
      title: 'Top Row Keys & Shift Capitalization (Q W E R T Y)',
      module: 'Lesson 13-25',
      duration: '20 mins',
      due: 'Sunday, 6:00 PM',
      status: 'IN_PROGRESS',
      accuracy: '94%',
      wpm: 24
    },
    {
      id: 'typing-3',
      title: 'Numbers & Symbols Speed Sprint (1 2 3 4 5 ! @ #)',
      module: 'Drill 04',
      duration: '10 mins',
      due: 'Next Week',
      status: 'UPCOMING',
      accuracy: '--',
      wpm: '--'
    }
  ];

  const badges = [
    { name: 'Home Row Hero', icon: '⌨️', desc: 'Achieved 20+ WPM with 95% accuracy' },
    { name: 'Speed Striker', icon: '⚡', desc: 'Completed 10 daily typing sprints' },
    { name: 'Accuracy Ace', icon: '🎯', desc: 'Zero error streak on 5 continuous paragraphs' },
  ];

  // LOCKED / GRAYED OUT STATE (WHEN NOT IN ENROLLED EDCLUB PROGRAM TRACK)
  if (!isAllowed) {
    return (
      <section className="relative overflow-hidden rounded-3xl bg-slate-900/60 dark:bg-slate-950/80 text-slate-400 border border-slate-800 shadow-lg p-5 sm:p-7 space-y-4 filter grayscale-[40%]">
        {/* Background ambient or faint banner */}
        {bannerUrl && (
          <>
            <img 
              src={bannerUrl} 
              alt="EdClub Banner Background" 
              className="absolute inset-0 w-full h-full object-cover object-center opacity-10 pointer-events-none"
            />
            <div className="absolute inset-0 bg-slate-950/80 pointer-events-none" />
          </>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400 flex items-center justify-center">
              <Lock size={22} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-slate-700">
                  <Lock size={10} className="text-amber-400" /> Locked Feature
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  Typing Masters Academy • EdClub
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-200 mt-1">
                {cardTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Enrolled Track: <strong className="text-slate-300 font-semibold">{enrolledProgramName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-500 text-xs font-bold cursor-not-allowed border border-slate-700/60"
            >
              <Lock size={13} />
              <span>EdClub Not Included in Track</span>
            </button>
          </div>
        </div>

        <div className="relative z-10 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2.5">
          <span className="text-amber-400 text-base">⚠️</span>
          <p className="leading-relaxed text-[11px]">
            This student account is currently enrolled in <strong>{enrolledProgramName}</strong>, which does not include the EdClub typing package. Contact your school administrator or Jaystarbliss tutor to upgrade or assign an EdClub-eligible curriculum track.
          </p>
        </div>
      </section>
    );
  }

  // ACTIVE UNLOCKED STATE WITH CUSTOM BANNER
  return (
    <section className="relative overflow-hidden rounded-3xl text-white border border-indigo-500/30 shadow-2xl p-5 sm:p-7 space-y-6">
      {/* Background Banner Image or High-Tech Gradient */}
      {bannerUrl ? (
        <>
          <img 
            src={bannerUrl} 
            alt="EdClub Banner Background" 
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-indigo-950/90 to-slate-950/85 pointer-events-none" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 pointer-events-none" />
      )}

      {/* Background ambient accents */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-900/60 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-md shadow-indigo-900/30">
            <Keyboard size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Sparkles size={11} />
                Typing Masters Academy
              </span>
              <span className="text-[10px] text-indigo-200 font-bold">
                In Collaboration with <strong className="text-white">EdClub</strong>
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1">
              {cardTitle}
            </h3>
            <p className="text-xs text-indigo-100/80 font-medium mt-0.5">
              Roster: {studentName} {studentClass ? `• ${studentClass}` : ''} {enrolledProgramName ? `• ${enrolledProgramName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 font-mono text-[11px] backdrop-blur-md">
            <span className="truncate max-w-[200px] sm:max-w-xs">{edclubUrl.replace('https://', '')}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy EdClub Link"
              aria-label="Copy EdClub Link"
              className="p-1 hover:text-white transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleLaunch}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs sm:text-sm font-black transition-all shadow-lg shadow-indigo-600/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ExternalLink size={15} />
            <span>Launch EdClub</span>
            <ArrowUpRight size={13} className="opacity-70" />
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="relative z-10 flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Weekly Goal & Speed
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('assignments')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'assignments'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          EdClub Assignments ({assignments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('milestones')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'milestones'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Milestones & Badges
        </button>
      </div>

      {/* Tab Content */}
      <div className="relative z-10">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Weekly Target */}
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Target size={14} /> Weekly Typing Target
                </span>
                <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  Active
                </span>
              </div>
              <p className="text-sm font-bold text-white leading-snug">
                {weeklyGoal.title}
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] font-semibold text-indigo-200">
                  <span>Lessons Completed</span>
                  <span className="font-mono font-bold text-white">{weeklyGoal.completedLessons} / {weeklyGoal.targetLessons}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-indigo-950 border border-indigo-800 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.round((weeklyGoal.completedLessons / weeklyGoal.targetLessons) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Target Speed & Accuracy */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Flame size={14} className="text-amber-400" /> Target Speed & Accuracy
              </span>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-2xl font-black font-mono text-amber-400">{weeklyGoal.targetWpm}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Target WPM</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-2xl font-black font-mono text-emerald-400">{weeklyGoal.targetAccuracy}%</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Accuracy Goal</div>
                </div>
              </div>
            </div>

            {/* Quick Practice Action */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-800/40 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Trophy size={14} className="text-amber-400" /> Typing Masters Drills
                </span>
                <p className="text-xs text-slate-300 mt-1.5">
                  Launch your EdClub workspace to practice daily 10-minute sprints.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLaunch}
                className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Open EdClub Lesson</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="space-y-2.5">
            {assignments.map((item) => (
              <div 
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : item.status === 'IN_PROGRESS'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.status === 'COMPLETED' ? <CheckCircle2 size={18} /> : <BookOpen size={18} />}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {item.module} • Due: {item.due} • {item.duration}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  {item.status === 'COMPLETED' ? (
                    <div className="text-right">
                      <span className="text-[11px] font-mono font-bold text-emerald-400">{item.wpm} WPM</span>
                      <span className="text-[10px] text-slate-400 block">{item.accuracy} acc</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLaunch}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span>Start Drill</span>
                      <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {badges.map((badge, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3"
              >
                <span className="text-2xl shrink-0">{badge.icon}</span>
                <div>
                  <h4 className="text-xs font-black text-white">{badge.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
