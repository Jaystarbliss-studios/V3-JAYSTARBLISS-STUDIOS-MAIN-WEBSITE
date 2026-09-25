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
  'technology student',
  'student',
  'scholar',
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
  'tutor planning workspace',
  'school portal',
  'school admin',
  'school administrator',
  'partner institution',
  'partner school',
  'partner school institution',
  'school',
  'school console',
  'unnamed school'
]);

// Extract a friendly first name or clean display title
function cleanFirstName(raw?: string, _isSchool = false): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  if (GENERIC_TITLES.has(cleaned.toLowerCase())) return '';

  // If email was passed, extract handle
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@')[0];
  }

  // If name has prefixes like "Cadet John Doe" or "Dr. Jane Smith"
  cleaned = cleaned.replace(/^(cadet|student|dr\.|mr\.|mrs\.|miss|engr\.|instructor|coach|tutor)\s+/i, '');

  // Remove numbers and special characters from handles e.g. johnrufai242 -> johnrufai -> John
  cleaned = cleaned.replace(/[0-9_.-]+/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) return '';

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  // Always return the engaging first name (e.g. "Christy" for "Christy Caleb International School", "John" for "John Doe")
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

  const isSchoolRole = role?.toLowerCase().includes('partner') || role?.toLowerCase().includes('school') || window.location.pathname.startsWith('/portal/school');

  useEffect(() => {
    let isMounted = true;

    const resolveName = async () => {
      // 1. Check if propName is a real person/school name
      if (propName && !GENERIC_TITLES.has(propName.trim().toLowerCase())) {
        const cleaned = cleanFirstName(propName, isSchoolRole);
        if (cleaned) {
          if (isMounted) setResolvedName(cleaned);
          return;
        }
      }

      // 2. Respect the active impersonated dashboard identity.
      const effective = getEffectiveAuth();
      if (effective.isMasquerading && effective.effectiveName && !GENERIC_TITLES.has(effective.effectiveName.trim().toLowerCase())) {
        const cleaned = cleanFirstName(effective.effectiveName, isSchoolRole);
        if (cleaned) {
          if (isMounted) setResolvedName(cleaned);
          return;
        }
      }

      // 3. For school portals, check sessionStorage / cached school record
      if (isSchoolRole) {
        const cachedSchool = sessionStorage.getItem('schoolName') || localStorage.getItem('jaystar_cached_school_name');
        if (cachedSchool && !GENERIC_TITLES.has(cachedSchool.trim().toLowerCase())) {
          if (isMounted) setResolvedName(cachedSchool.trim());
          return;
        }
      }

      // 4. Check current authenticated user displayName
      const currentUser = auth.currentUser;
      if (currentUser?.displayName && !GENERIC_TITLES.has(currentUser.displayName.trim().toLowerCase())) {
        const cleaned = cleanFirstName(currentUser.displayName, isSchoolRole);
        if (cleaned) {
          if (isMounted) setResolvedName(cleaned);
          return;
        }
      }

      // 5. Check session/local storage cached name
      const cached = sessionStorage.getItem('userName') || localStorage.getItem('jaystar_cached_user_name');
      if (cached && !GENERIC_TITLES.has(cached.trim().toLowerCase())) {
        const cleaned = cleanFirstName(cached, isSchoolRole);
        if (cleaned) {
          if (isMounted) setResolvedName(cleaned);
          return;
        }
      }

      // 6. Try fetching from Firestore users & schools collection
      if (currentUser?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && isMounted) {
            const data = userDoc.data();
            if (isSchoolRole) {
              const schoolId = data?.schoolId;
              if (schoolId) {
                const sDoc = await getDoc(doc(db, 'schools', schoolId));
                if (sDoc.exists() && sDoc.data()?.name) {
                  setResolvedName(sDoc.data().name);
                  return;
                }
              }
            }
            const fullName = data?.schoolName || data?.name || data?.fullName || data?.displayName;
            if (fullName && !GENERIC_TITLES.has(fullName.trim().toLowerCase())) {
              const cleaned = cleanFirstName(fullName, isSchoolRole);
              if (cleaned) {
                setResolvedName(cleaned);
                return;
              }
            }
          }
        } catch {
          // ignore error and fallback
        }
      }

      // 7. Fallback to email handle
      if (currentUser?.email) {
        const emailHandle = currentUser.email.split('@')[0];
        const cleaned = cleanFirstName(emailHandle);
        if (cleaned && isMounted) {
          setResolvedName(cleaned);
          return;
        }
      }

      if (isMounted) setResolvedName(isSchoolRole ? 'Partner School' : 'Learner');
    };

    resolveName();

    return () => {
      isMounted = false;
    };
  }, [propName, isSchoolRole]);

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
