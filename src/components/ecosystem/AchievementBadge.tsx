import React, { useState } from 'react';
import { 
  Code2, 
  Brain, 
  Palette, 
  Keyboard, 
  Crown, 
  Calculator, 
  ShieldCheck, 
  Sparkles, 
  Trophy, 
  CheckCircle2, 
  Lock, 
  X,
  Share2,
  Calendar
} from 'lucide-react';

export type BadgeCategory = 'coding' | 'logic' | 'creative' | 'academics' | 'literacy' | 'milestone';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master';

export interface AchievementBadgeData {
  id: string;
  title: string;
  category: BadgeCategory;
  tier: BadgeTier;
  description: string;
  criteria: string;
  iconName: string;
  xpValue: number;
  unlockedAt?: string; // ISO date or formatted string
  progress?: number;   // 0 to 100
  isLocked?: boolean;
}

export const PRESET_ACHIEVEMENTS: AchievementBadgeData[] = [
  {
    id: 'master-coder',
    title: 'Master Coder',
    category: 'coding',
    tier: 'master',
    description: 'Architected and deployed a multi-module full-stack application with clean code and interactive state.',
    criteria: 'Complete Stage 4 & 5 Capstone in School of Technology & Programming.',
    iconName: 'Code2',
    xpValue: 500,
    unlockedAt: '2025-01-15',
    progress: 100,
    isLocked: false
  },
  {
    id: 'top-logic',
    title: 'Top Logic & Algorithmic Thinker',
    category: 'logic',
    tier: 'gold',
    description: 'Demonstrated superior pattern recognition and tactical problem solving in chess and logic puzzles.',
    criteria: 'Solve 50+ computational logic exercises and tactical puzzles.',
    iconName: 'Brain',
    xpValue: 400,
    unlockedAt: '2025-02-10',
    progress: 100,
    isLocked: false
  },
  {
    id: 'creative-virtuoso',
    title: 'Creative Virtuoso',
    category: 'creative',
    tier: 'gold',
    description: 'Produced an original multimedia brand identity or musical composition demonstrating Stage 4 mastery.',
    criteria: 'Complete capstone project in School of Creative Design or Music Academy.',
    iconName: 'Palette',
    xpValue: 450,
    unlockedAt: '2025-02-28',
    progress: 100,
    isLocked: false
  },
  {
    id: 'speed-typer-pro',
    title: 'Speed Typer (40+ WPM)',
    category: 'literacy',
    tier: 'silver',
    description: 'Achieved 40+ Words Per Minute with 95%+ touch-typing accuracy in Junior Digital Explorers.',
    criteria: 'Pass the timed touch-typing diagnostic test in Digital Literacy School.',
    iconName: 'Keyboard',
    xpValue: 250,
    unlockedAt: '2025-01-20',
    progress: 100,
    isLocked: false
  },
  {
    id: 'stage-5-master',
    title: 'Stage 5 Ecosystem Master',
    category: 'milestone',
    tier: 'diamond',
    description: 'Successfully navigated the complete 5-stage pathway from DISCOVER to MASTER with demo day exhibition.',
    criteria: 'Complete all 5 stages in any Jaystarbliss Academy pathway.',
    iconName: 'Crown',
    xpValue: 1000,
    progress: 75,
    isLocked: false
  },
  {
    id: 'math-clinic-ace',
    title: 'Math Clinic High Achiever',
    category: 'academics',
    tier: 'gold',
    description: 'Earned distinction marks in diagnostic math clinic exams and exam prep drills.',
    criteria: 'Achieve 85%+ in consecutive CBT mock examinations.',
    iconName: 'Calculator',
    xpValue: 350,
    unlockedAt: '2025-02-05',
    progress: 100,
    isLocked: false
  },
  {
    id: 'cyber-safety-shield',
    title: 'Cyber Safety & Ethics Certified',
    category: 'literacy',
    tier: 'silver',
    description: 'Mastered digital footprints, safe web browsing, credential hygiene, and ethical AI utilization.',
    criteria: 'Complete Digital Safety and Smart Search modules.',
    iconName: 'ShieldCheck',
    xpValue: 200,
    unlockedAt: '2025-01-10',
    progress: 100,
    isLocked: false
  },
  {
    id: 'curiosity-explorer',
    title: 'Curiosity Explorer (10+ Sessions)',
    category: 'milestone',
    tier: 'bronze',
    description: 'Maintained consistent attendance and project submissions across 10 consecutive mentored sessions.',
    criteria: 'Attend 10+ live or classroom sessions with active participation.',
    iconName: 'Sparkles',
    xpValue: 200,
    unlockedAt: '2025-01-30',
    progress: 100,
    isLocked: false
  }
];

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Code2,
  Brain,
  Palette,
  Keyboard,
  Crown,
  Calculator,
  ShieldCheck,
  Sparkles,
  Trophy
};

const TIER_THEMES: Record<BadgeTier, { border: string; bg: string; text: string; ring: string; label: string }> = {
  bronze: {
    border: 'border-amber-700/40 dark:border-amber-600/30',
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10',
    text: 'text-amber-800 dark:text-amber-300',
    ring: 'ring-amber-600/20',
    label: 'Bronze Tier'
  },
  silver: {
    border: 'border-slate-300 dark:border-slate-700',
    bg: 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/40 dark:to-slate-900/40',
    text: 'text-slate-700 dark:text-slate-200',
    ring: 'ring-slate-400/20',
    label: 'Silver Tier'
  },
  gold: {
    border: 'border-amber-400 dark:border-amber-500/40',
    bg: 'bg-gradient-to-br from-amber-50 via-yellow-50/40 to-amber-100/30 dark:from-amber-950/30 dark:via-slate-900 dark:to-yellow-950/20',
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/30',
    label: 'Gold Tier'
  },
  diamond: {
    border: 'border-cyan-400 dark:border-cyan-500/40',
    bg: 'bg-gradient-to-br from-cyan-50 via-blue-50/40 to-indigo-50/30 dark:from-cyan-950/30 dark:via-slate-900 dark:to-blue-950/20',
    text: 'text-cyan-600 dark:text-cyan-400',
    ring: 'ring-cyan-500/30',
    label: 'Diamond Tier'
  },
  master: {
    border: 'border-purple-400 dark:border-purple-500/40',
    bg: 'bg-gradient-to-br from-purple-50 via-indigo-50/40 to-purple-100/30 dark:from-purple-950/30 dark:via-slate-900 dark:to-indigo-950/20',
    text: 'text-purple-600 dark:text-purple-400',
    ring: 'ring-purple-500/30',
    label: 'Master Tier'
  }
};

/**
 * Individual Achievement Badge card / pill component
 */
export const AchievementBadge: React.FC<{
  badge: AchievementBadgeData;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}> = ({ badge, size = 'md', onClick }) => {
  const [showModal, setShowModal] = useState(false);
  const theme = TIER_THEMES[badge.tier] || TIER_THEMES.bronze;
  const IconComponent = ICON_MAP[badge.iconName] || Trophy;
  const isLocked = badge.isLocked || (badge.progress !== undefined && badge.progress < 100 && !badge.unlockedAt);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setShowModal(true);
    }
  };

  if (size === 'sm') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:scale-105 ${
            isLocked
              ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400'
              : `${theme.border} ${theme.bg} ${theme.text} shadow-xs`
          }`}
          title={`${badge.title} (${badge.xpValue} XP)`}
        >
          {isLocked ? <Lock size={13} className="text-slate-400" /> : <IconComponent size={13} />}
          <span className="truncate max-w-[140px]">{badge.title}</span>
          <span className="text-[10px] opacity-75 font-mono">+{badge.xpValue}XP</span>
        </button>

        {showModal && (
          <AchievementDetailModal badge={badge} onClose={() => setShowModal(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div
        onClick={handleClick}
        className={`group relative rounded-2xl border p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
          isLocked
            ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 opacity-75'
            : `${theme.border} ${theme.bg} ring-1 ${theme.ring} shadow-xs`
        }`}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
            isLocked
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              : `bg-white dark:bg-slate-800 ${theme.text} border border-slate-200 dark:border-slate-700 group-hover:scale-110 transition-transform`
          }`}>
            {isLocked ? <Lock size={20} /> : <IconComponent size={22} />}
          </div>

          <div className="text-right">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
              isLocked
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}>
              {theme.label}
            </span>
            <div className="text-xs font-black text-slate-900 dark:text-white mt-1">
              +{badge.xpValue} XP
            </div>
          </div>
        </div>

        {/* Badge Title & Description */}
        <div className="mt-3 space-y-1">
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-brand-red transition-colors flex items-center gap-1.5">
            {badge.title}
            {!isLocked && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-normal">
            {badge.description}
          </p>
        </div>

        {/* Progress or Unlock Date */}
        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
          {badge.unlockedAt ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Calendar size={12} /> Earned {badge.unlockedAt}
            </span>
          ) : (
            <div className="w-full space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>Progress</span>
                <span>{badge.progress || 0}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-red rounded-full transition-all"
                  style={{ width: `${badge.progress || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AchievementDetailModal badge={badge} onClose={() => setShowModal(false)} />
      )}
    </>
  );
};

/**
 * Full Achievement Showcase Grid with category filters & XP summary
 */
export const AchievementBadgeGrid: React.FC<{
  badges?: AchievementBadgeData[];
  title?: string;
  subtitle?: string;
  studentName?: string;
}> = ({ 
  badges = PRESET_ACHIEVEMENTS,
  title = "Student Achievements & Mastery Badges",
  subtitle = "Verifiable milestone badges earned across Jaystarbliss Programs.",
  studentName
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const totalXP = badges
    .filter(b => b.unlockedAt || b.progress === 100)
    .reduce((sum, b) => sum + b.xpValue, 0);

  const unlockedCount = badges.filter(b => b.unlockedAt || b.progress === 100).length;

  const categories = [
    { id: 'ALL', label: 'All Badges' },
    { id: 'coding', label: 'Tech & Code' },
    { id: 'logic', label: 'Logic & Chess' },
    { id: 'creative', label: 'Creative Arts' },
    { id: 'academics', label: 'Academics' },
    { id: 'literacy', label: 'Digital Literacy' },
    { id: 'milestone', label: 'Milestones' }
  ];

  const filteredBadges = selectedCategory === 'ALL'
    ? badges
    : badges.filter(b => b.category === selectedCategory);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
      
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {studentName ? `${studentName}'s earned certifications & technical badges.` : subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-center">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Total XP</span>
            <span className="text-lg font-black text-amber-700 dark:text-amber-300">{totalXP} XP</span>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Unlocked</span>
            <span className="text-lg font-black text-slate-900 dark:text-white">{unlockedCount} / {badges.length}</span>
          </div>
        </div>
      </div>

      {/* Filter Selector */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-red cursor-pointer appearance-none"
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
            ▼
          </div>
        </div>
        <span className="text-xs font-bold text-slate-400 shrink-0">
          {filteredBadges.length} Badges
        </span>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredBadges.map(badge => (
          <AchievementBadge key={badge.id} badge={badge} />
        ))}
      </div>
    </div>
  );
};

/**
 * Detail modal showing milestone criteria, shareable status, and verification
 */
const AchievementDetailModal: React.FC<{
  badge: AchievementBadgeData;
  onClose: () => void;
}> = ({ badge, onClose }) => {
  const [copied, setCopied] = useState(false);
  const theme = TIER_THEMES[badge.tier] || TIER_THEMES.bronze;
  const IconComponent = ICON_MAP[badge.iconName] || Trophy;
  const isUnlocked = Boolean(badge.unlockedAt || badge.progress === 100);

  const handleShare = () => {
    const text = `I earned the ${badge.title} badge at Jaystarbliss Studios!`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-6">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Hero Icon */}
        <div className="text-center space-y-3">
          <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-lg ${theme.bg} ${theme.text} ${theme.border} border-2`}>
            <IconComponent size={40} />
          </div>

          <div>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${theme.bg} ${theme.text} border ${theme.border}`}>
              {theme.label} • +{badge.xpValue} XP
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {badge.title}
            </h3>
          </div>
        </div>

        {/* Description & Criteria */}
        <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Achievement Overview
            </span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {badge.description}
            </p>
          </div>

          <div>
            <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Milestone Criteria
            </span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              {badge.criteria}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-slate-500 font-medium">
            <span>Status</span>
            <span className={isUnlocked ? 'text-emerald-500 font-bold flex items-center gap-1' : 'text-amber-500 font-bold'}>
              {isUnlocked ? `Earned (${badge.unlockedAt || 'Verified'})` : `In Progress (${badge.progress || 0}%)`}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 size={14} />
            {copied ? 'Copied to Clipboard!' : 'Share Achievement'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-brand-slate hover:bg-slate-800 text-white font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
