import React from 'react';
import { 
  AchievementBadge, 
  AchievementBadgeGrid, 
  type AchievementBadgeData, 
  type BadgeTier, 
  type BadgeCategory,
  PRESET_ACHIEVEMENTS 
} from '../ecosystem/AchievementBadge';

type BadgeVariant = 
  | 'brand' 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'neutral' 
  | 'outline'
  | 'gold'
  | 'purple'
  | 'cyan'
  | 'achievement';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral', 
  className = '', 
  ...props 
}) => {
  const baseClasses = 'inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full shadow-xs';
  
  const variants: Record<BadgeVariant, string> = {
    brand: 'bg-brand-red/10 text-brand-red dark:bg-brand-red/20',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    outline: 'bg-transparent border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300',
    gold: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700',
    cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700',
    achievement: 'bg-gradient-to-r from-amber-500/15 to-purple-500/15 text-slate-800 dark:text-slate-200 border border-amber-500/30'
  };

  return (
    <span className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};

export { 
  Badge, 
  AchievementBadge, 
  AchievementBadgeGrid, 
  PRESET_ACHIEVEMENTS,
  type AchievementBadgeData,
  type BadgeTier,
  type BadgeCategory
};

export default Badge;

