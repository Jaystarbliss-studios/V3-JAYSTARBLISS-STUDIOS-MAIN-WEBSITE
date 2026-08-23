import React, { useState, useEffect } from 'react';
import { Sparkles, Sun, Sunset, Moon, Clock, Globe, CheckCircle2 } from 'lucide-react';
import { auth } from '../../lib/firebase';

interface DashboardGreetingProps {
  name?: string;
  role?: string;
  subtitle?: string;
  badge?: string;
  showQuickStats?: boolean;
}

// Extract a friendly first name or clean display title
export function getFriendlyFirstName(rawName?: string): string {
  if (!rawName) {
    const user = auth.currentUser;
    if (user?.displayName) rawName = user.displayName;
    else if (user?.email) rawName = user.email.split('@')[0];
    else rawName = sessionStorage.getItem('userName') || 'Cadet';
  }

  // Clean email handles if an email was passed as name
  if (rawName.includes('@')) {
    rawName = rawName.split('@')[0];
  }

  // Remove numbers from handles like johnrufai242 -> John Rufai or John
  const cleaned = rawName.replace(/[0-9_.-]+/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 'Cadet';

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
  role = 'student',
  subtitle,
  badge,
  showQuickStats = true
}) => {
  const [headline, setHeadline] = useState('');
  const [greetingIcon, setGreetingIcon] = useState<React.ReactNode>(<Sun size={24} className="text-amber-400" />);
  const [timeString, setTimeString] = useState('');
  const [timeZone, setTimeZone] = useState('');

  const displayName = getFriendlyFirstName(name);

  useEffect(() => {
    const updateGreeting = () => {
      const now = new Date();
      const hours = now.getHours();

      let options: string[] = [];
      let icon: React.ReactNode = <Sun size={24} className="text-amber-400" />;

      if (hours >= 22 || hours < 5) {
        // Late night
        options = [
          `Late night login, ${displayName}?`,
          `Burning the midnight oil, ${displayName}?`,
          `Late night hustle, ${displayName}?`,
          `Night owl mode active, ${displayName}!`
        ];
        icon = <Moon size={24} className="text-indigo-400 animate-pulse" />;
      } else if (hours >= 5 && hours < 9) {
        // Early morning
        options = [
          `Early riser check in, ${displayName}?`,
          `Rise and innovate, ${displayName}!`,
          `Good morning, ${displayName}!`,
          `Bright and early, ${displayName}!`
        ];
        icon = <Sun size={24} className="text-amber-400 animate-pulse" />;
      } else if (hours >= 9 && hours < 12) {
        // Morning
        options = [
          `Good morning, ${displayName}!`,
          `Ready to build today, ${displayName}?`,
          `Morning momentum, ${displayName}!`
        ];
        icon = <Sun size={24} className="text-yellow-400" />;
      } else if (hours >= 12 && hours < 17) {
        // Afternoon
        options = [
          `Good afternoon, ${displayName}!`,
          `Midday momentum, ${displayName}!`,
          `Afternoon focus mode, ${displayName}?`,
          `Building the future, ${displayName}!`
        ];
        icon = <Sun size={24} className="text-orange-400" />;
      } else {
        // Evening (17 - 21)
        options = [
          `Good evening, ${displayName}!`,
          `Wrapping up the day, ${displayName}?`,
          `Evening review, ${displayName}!`,
          `Great progress today, ${displayName}!`
        ];
        icon = <Sunset size={24} className="text-pink-400" />;
      }

      // Pick a pseudo-stable option based on current minute / day or random
      const selected = options[Math.floor(Math.random() * options.length)];
      setHeadline(selected);
      setGreetingIcon(icon);

      setTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimeZone(tz.replace('_', ' '));
      } catch {
        setTimeZone('WAT (GMT+1)');
      }
    };

    updateGreeting();
    const interval = setInterval(() => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 30000);

    return () => clearInterval(interval);
  }, [displayName]);

  const defaultSubtitle = subtitle || 'Welcome to your internal operations hub. Track active cohorts, syllabus outcomes, and secured exam materials.';

  return (
    <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-slate-700/60">
      {/* Decorative Glow elements */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-red/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-md text-slate-200 border border-white/15">
              {greetingIcon}
              <span className="capitalize">{role} Console</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>LIVE SYSTEM</span>
            </span>

            {badge && (
              <span className="px-3 py-1 rounded-full text-xs font-black bg-brand-red/20 text-red-300 border border-brand-red/40 uppercase tracking-wide">
                {badge}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
            {headline || `Welcome, ${displayName}!`}
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm md:text-base max-w-2xl flex items-center gap-2 leading-relaxed">
            <Sparkles size={16} className="text-amber-400 shrink-0 hidden sm:inline" />
            <span>{defaultSubtitle}</span>
          </p>
        </div>

        {/* Local Time and Hub Status Widget */}
        {showQuickStats && (
          <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-700/80 flex flex-col gap-3 min-w-[240px] shrink-0 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={14} className="text-brand-red" /> Local Time
              </span>
              <span className="font-mono font-bold text-white text-base tracking-wider bg-slate-950 px-2.5 py-0.5 rounded-md border border-slate-800">
                {timeString}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                <Globe size={13} className="text-blue-400" /> {timeZone || 'WAT (GMT+1)'}
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 size={11} /> Synced
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardGreeting;
