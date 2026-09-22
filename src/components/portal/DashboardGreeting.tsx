import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { getEffectiveAuth } from '../../utils/impersonation';
import { doc, getDoc } from 'firebase/firestore';

interface DashboardGreetingProps {
  name?: string;
  role?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const GENERIC_TITLES = new Set([
  'parent & guardian console',
  'parent / guardian',
  'parent portal',
  'parent',
  'guardian',
  'faculty instructor',
  'faculty mentor',
  'tutor',
  'tutor workspace',
  'staff',
  'staff console',
  'staff teaching console',
  'technology cadet',
  'student',
  'scholar',
  'cadet',
  'cadet student',
  'teaching workspace',
  'parent learning view',
  'school learning view',
  'learner workspace',
  'assessment workspace',
  'my assessments',
  'child assessments',
  'school assessments',
  'administrator',
  'admin',
  'admin officer',
  'admin console',
  'super admin',
  'overview',
  'learning progress',
  'tutor planning workspace'
]);

// Extract a friendly first name or clean display title
function cleanFirstName(raw?: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();

  // If name has prefixes like "Cadet John Doe" or "Dr. Jane Smith"
  cleaned = cleaned.replace(/^(cadet|student|dr\.|mr\.|mrs\.|miss|engr\.|instructor|coach|tutor)\s+/i, '');

  // If email was passed, extract handle
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@')[0];
  }

  // Remove numbers from handles e.g. johnrufai242 -> johnrufai -> John
  cleaned = cleaned.replace(/[0-9_.-]+/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) return '';

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  // If it is an institution name
  if (raw.toLowerCase().includes('school') || raw.toLowerCase().includes('college') || raw.toLowerCase().includes('academy') || raw.toLowerCase().includes('institute')) {
    return words.map(capitalize).join(' ');
  }

  return capitalize(words[0]);
}

export const DashboardGreeting: React.FC<DashboardGreetingProps> = ({
  name: propName,
  role,
  subtitle,
  action
}) => {
  const [headline, setHeadline] = useState('Good morning');
  const [formattedDate, setFormattedDate] = useState('');
  const [resolvedName, setResolvedName] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const resolveName = async () => {
      // 1. Check if propName is a real person/school name
      if (propName && !GENERIC_TITLES.has(propName.trim().toLowerCase())) {
        const cleaned = cleanFirstName(propName);
        if (cleaned) {
          if (isMounted) setResolvedName(cleaned);
          return;
        }
      }

      // 2. Respect the active impersonated dashboard identity.
      const effective = getEffectiveAuth();
      if (effective.isMasquerading && effective.effectiveName) {
        const cleaned = cleanFirstName(effective.effectiveName);
        if (cleaned) {
          if (isMounted) setResolvedName(cleaned);
          return;
        }
      }

      // 3. Check current authenticated user
      const currentUser = auth.currentUser;
      if (currentUser?.displayName) {
        const cleaned = cleanFirstName(currentUser.displayName);
        if (cleaned) {
          if (isMounted) setResolvedName(cleaned);
          return;
        }
      }

      // 4. Check session/local storage cached name
      const cached = sessionStorage.getItem('userName') || localStorage.getItem('jaystar_cached_user_name');
      if (cached && !GENERIC_TITLES.has(cached.trim().toLowerCase())) {
        const cleaned = cleanFirstName(cached);
        if (cleaned) {
          if (isMounted) setResolvedName(cleaned);
          return;
        }
      }

      // 5. Try fetching from Firestore users collection
      if (currentUser?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && isMounted) {
            const data = userDoc.data();
            const fullName = data?.name || data?.fullName || data?.displayName || data?.schoolName;
            if (fullName) {
              const cleaned = cleanFirstName(fullName);
              if (cleaned) {
                setResolvedName(cleaned);
                return;
              }
            }
          }
        } catch {
          // ignore error and fallback to email handle
        }
      }

      // 6. Fallback to email handle
      if (currentUser?.email) {
        const emailHandle = currentUser.email.split('@')[0];
        const cleaned = cleanFirstName(emailHandle);
        if (cleaned && isMounted) {
          setResolvedName(cleaned);
          return;
        }
      }

      if (isMounted) setResolvedName('Friend');
    };

    resolveName();

    return () => {
      isMounted = false;
    };
  }, [propName]);

  useEffect(() => {
    const now = new Date();
    const hours = now.getHours();

    let prefix = 'Good morning';
    if (hours >= 12 && hours < 17) {
      prefix = 'Good afternoon';
    } else if (hours >= 17) {
      prefix = 'Good evening';
    }

    if (resolvedName) {
      setHeadline(`${prefix}, ${resolvedName}!`);
    } else {
      setHeadline(`${prefix}!`);
    }

    setFormattedDate(
      now.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    );
  }, [resolvedName]);

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
