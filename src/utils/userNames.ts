/**
 * Utility to reliably resolve and format human-readable Real Names for Tutors, Staff, Students, and Parents.
 * Eliminates generic placeholder strings like "Tutor", "Instructor", "Faculty", "Tutor, Instructor", "Staff", etc.
 */

// Regular expression matching any combination of generic titles/roles
const GENERIC_TITLES_REGEX = /^(tutor|instructor|faculty|staff|teacher|mentor|educator|admin|superadmin|super admin|user|member|cadet|student|parent|guardian|account|anonymous|guest|undefined|null|none|n\/a|unassigned)(\s*[,/&|+\-–—:\\]\s*(tutor|instructor|faculty|staff|teacher|mentor|educator|admin|superadmin|user|member|lead|cadet|student|account|[0-9#_\-]+))*$/i;

const GENERIC_PLACEHOLDERS_SET = new Set([
  'tutor',
  'instructor',
  'tutor, instructor',
  'tutor/instructor',
  'tutor instructor',
  'instructor, tutor',
  'instructor tutor',
  'faculty',
  'faculty member',
  'faculty tutor',
  'faculty instructor',
  'faculty mentor',
  'faculty / instructor',
  'faculty, instructor',
  'lead mentor',
  'lead tutor',
  'lead instructor',
  'staff',
  'staff member',
  'staff / tutor',
  'staff, tutor',
  'user',
  'admin',
  'super admin',
  'superadmin',
  'anonymous',
  'student',
  'cadet',
  'student cadet',
  'undefined',
  'null',
  '[object object]',
  'n/a',
  'none',
  'parent',
  'guardian',
  'unassigned'
]);

/**
 * Check if a candidate name is a valid, genuine human name and NOT a generic title/placeholder
 */
export const isValidHumanName = (name?: string | null): boolean => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  
  const lower = trimmed.toLowerCase();
  if (GENERIC_PLACEHOLDERS_SET.has(lower)) return false;
  if (GENERIC_TITLES_REGEX.test(trimmed)) return false;
  
  // Reject if it's just "Tutor" or "Instructor" or "Staff" with trailing numbers or punctuation
  if (/^(tutor|instructor|staff|faculty|user|admin)\s*[0-9#_\-.]*$/i.test(trimmed)) return false;

  return true;
};

/**
 * Clean up and extract a human-readable name from an email address
 * e.g. "johnrufai242@gmail.com" -> "John Rufai"
 * e.g. "okoh.wisdom@yahoo.com" -> "Okoh Wisdom"
 * e.g. "godwin_uzor@hotmail.com" -> "Godwin Uzor"
 * e.g. "chidinma-blessing@domain.com" -> "Chidinma Blessing"
 */
export const extractNameFromEmail = (email?: string | null): string => {
  if (!email || !email.includes('@')) return '';
  const prefix = email.split('@')[0];
  
  // Clean up prefix: replace numbers, punctuation, dots with spaces
  const cleanPrefix = prefix
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-zA-Z]/g, ' ')
    .trim();

  const rawWords = cleanPrefix.split(/\s+/).filter(w => w.length > 0);
  
  // Filter out any generic title words like 'tutor', 'staff', 'instructor'
  const filteredWords = rawWords.filter(w => !['tutor', 'staff', 'instructor', 'faculty', 'admin', 'user', 'test', 'demo'].includes(w.toLowerCase()));
  
  const wordsToUse = filteredWords.length > 0 ? filteredWords : rawWords;
  if (wordsToUse.length === 0) return '';

  return wordsToUse
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Master resolution function to find the real name of a user/tutor/staff from any document or metadata
 */
export const resolveRealName = (
  data?: Record<string, any> | null,
  fallbackEmail?: string | null,
  defaultFallback?: string
): string => {
  const email = (data?.email || fallbackEmail || '').trim();

  // 1. Check composite firstName + lastName
  if (data) {
    const fName = (data.firstName || data.first_name || '').trim();
    const lName = (data.lastName || data.last_name || '').trim();
    if (fName && lName) {
      const full = `${fName} ${lName}`.trim();
      if (isValidHumanName(full)) return full;
    }
    if (fName && isValidHumanName(fName)) return fName;
  }

  // 2. Check candidate name fields in priority order
  const candidates = [
    data?.fullName,
    data?.realName,
    data?.name,
    data?.displayName,
    data?.applicantName,
    data?.contactName,
    data?.tutorName,
    data?.staffName,
    data?.instructorName,
    data?.userName,
    data?.firstName,
    data?.lastName
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isValidHumanName(candidate)) {
      return candidate.trim();
    }
  }

  // 3. Fall back to deriving human name from email address
  const derivedFromEmail = extractNameFromEmail(email);
  if (derivedFromEmail && isValidHumanName(derivedFromEmail)) {
    return derivedFromEmail;
  }

  // 4. If default fallback was explicitly provided, use it, else derive or return cleanest option
  if (defaultFallback && isValidHumanName(defaultFallback)) {
    return defaultFallback;
  }

  // If email has at least a username prefix, return capitalized email username
  if (email && email.includes('@')) {
    const fallbackPrefix = email.split('@')[0];
    if (fallbackPrefix) {
      return fallbackPrefix.charAt(0).toUpperCase() + fallbackPrefix.slice(1);
    }
  }

  return defaultFallback || 'Jaystarbliss Lead Mentor';
};

/**
 * Format a tutor for dropdown display: "John Rufai (john@example.com • Robotics Lead)"
 * Strips redundant generic placeholders ("Instructor", "Tutor", "Faculty") from meta tags.
 */
export const formatTutorDropdownLabel = (
  name: string,
  email?: string,
  qualification?: string,
  specialization?: string
): string => {
  const cleanName = resolveRealName({ name, email }, email, name);
  const parts: string[] = [cleanName];
  const meta: string[] = [];

  // Add qualification if not generic
  if (qualification && qualification.length < 40 && isValidHumanName(qualification) && !cleanName.toLowerCase().includes(qualification.toLowerCase())) {
    meta.push(qualification.trim());
  }

  // Add specialization if not generic
  if (specialization && specialization.length < 40 && isValidHumanName(specialization) && !cleanName.toLowerCase().includes(specialization.toLowerCase())) {
    meta.push(specialization.trim());
  }

  // Add email for unambiguous identification
  if (email && email.includes('@')) {
    meta.push(email.trim().toLowerCase());
  }

  if (meta.length > 0) {
    return `${parts.join(' ')} (${meta.join(' • ')})`;
  }
  return cleanName;
};
