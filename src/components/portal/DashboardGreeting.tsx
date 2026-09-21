import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { auth } from '../../lib/firebase';

interface DashboardGreetingProps {
  name?: string;
  role?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

// Extract a friendly first name or clean display title
function getFriendlyFirstName(rawName?: string): string {
  if (!rawName) {
    const user = auth.currentUser;
    if (user?.displayName) rawName = user.displayName;
    else if (user?.email) rawName = user.email.split('@')[0];
    else rawName = sessionStorage.getItem('userName') || 'Cadet';
  }

  // If name has prefixes like "Cadet John Doe" or "Dr. Jane Smith"
  rawName = rawName.replace(/^(cadet|student|dr\.|mr\.|mrs\.|miss|engr\.|instructor|coach)\s+/i, '');

  // Clean email handles if an email was passed as name
  if (rawName.includes('@')) {
    rawName = rawName.split('@')[0];
  }

  // Remove numbers and special characters from handles like johnrufai242 -> John Rufai
  const cleaned = rawName.replace(/[0-9_.-]+/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 'Scholar';

  // Capitalize properly
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  // If it looks like a school name (e.g. "Grace High School"), keep the whole name
  if (rawName.toLowerCase().includes('school') || rawName.toLowerCase().includes('college') || rawName.toLowerCase().includes('academy')) {
    return words.map(capitalize).join(' ');
  }

  return capitalize(words[0]);
}

export const DashboardGreeting: React.FC<DashboardGreetingProps> = ({
  name,
  role,
  subtitle,
  action
}) => {
  const [headline, setHeadline] = useState('');
  const [formattedDate, setFormattedDate] = useState('');

  const firstName = getFriendlyFirstName(name);

  useEffect(() => {
    const now = new Date();
    const hours = now.getHours();

    let prefix = 'Good morning';
    if (hours >= 12 && hours < 17) {
      prefix = 'Good afternoon';
    } else if (hours >= 17) {
      prefix = 'Good evening';
    }

    setHeadline(`${prefix}, ${firstName}`);
    setFormattedDate(
      now.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    );
  }, [firstName]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {headline}
          </h1>
          {role && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 capitalize">
              {role}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {subtitle || 'Keep going. Your future is in progress.'}
        </p>
      </div>

      <div className="flex items-center gap-2.5 self-start sm:self-auto">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-xs">
          <Calendar size={13} className="text-brand-red" />
          <span>{formattedDate}</span>
        </div>
        {action}
      </div>
    </div>
  );
};

export default DashboardGreeting;
