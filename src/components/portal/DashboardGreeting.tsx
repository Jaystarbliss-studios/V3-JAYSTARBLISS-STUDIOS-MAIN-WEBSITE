import React, { useState, useEffect } from 'react';
import { Sun, Sunset, Moon } from 'lucide-react';
import { auth } from '../../lib/firebase';

interface DashboardGreetingProps {
  name?: string;
  role?: string;
  subtitle?: string;
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
  subtitle
}) => {
  const [headline, setHeadline] = useState('');
  const [greetingIcon, setGreetingIcon] = useState<React.ReactNode>(<Sun size={20} className="text-amber-400" />);

  const firstName = getFriendlyFirstName(name);

  useEffect(() => {
    const updateGreeting = () => {
      const now = new Date();
      const hours = now.getHours();

      let prefix = 'Hello';
      let icon: React.ReactNode = <Sun size={20} className="text-amber-400" />;

      if (hours >= 5 && hours < 12) {
        prefix = 'Good morning';
        icon = <Sun size={20} className="text-amber-400" />;
      } else if (hours >= 12 && hours < 17) {
        prefix = 'Good afternoon';
        icon = <Sun size={20} className="text-amber-500" />;
      } else if (hours >= 17 && hours < 22) {
        prefix = 'Good evening';
        icon = <Sunset size={20} className="text-amber-600" />;
      } else {
        // Late night
        prefix = 'Good evening';
        icon = <Moon size={20} className="text-slate-300" />;
      }

      // Greeting ALWAYS ends with the first name of the user
      setHeadline(`${prefix}, ${firstName}.`);
      setGreetingIcon(icon);
    };

    updateGreeting();
  }, [firstName]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          {greetingIcon}
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {headline}
          </h1>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 max-w-xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardGreeting;
