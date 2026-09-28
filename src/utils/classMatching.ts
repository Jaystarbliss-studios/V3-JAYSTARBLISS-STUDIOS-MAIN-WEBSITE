/**
 * Precise class normalization and matching utility for School Students and Timetables.
 */

export function normalizeClassName(val: unknown): string {
  if (!val) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
    .replace(/^class\s+/i, '')
    .trim();
}

export interface ParsedClassStructure {
  raw: string;
  normalized: string;
  category: string; // 'primary', 'year', 'grade', 'jss', 'sss', 'basic', or 'generic'
  num: number | null;
  arm: string; // 'a', 'b', 'c', 'gold', 'diamond', etc.
  isAll: boolean;
}

export function parseClassString(classStr: unknown): ParsedClassStructure {
  const norm = normalizeClassName(classStr);
  if (!norm) {
    return { raw: '', normalized: '', category: 'generic', num: null, arm: '', isAll: false };
  }

  if (['all', 'all classes', 'general', 'whole school', 'universal', 'any'].includes(norm)) {
    return { raw: String(classStr), normalized: norm, category: 'all', num: null, arm: '', isAll: true };
  }

  // Check prefix
  let category = 'generic';
  if (norm.startsWith('primary') || norm.startsWith('pry') || norm.startsWith('p')) category = 'primary';
  else if (norm.startsWith('year') || norm.startsWith('yr') || norm.startsWith('y')) category = 'year';
  else if (norm.startsWith('grade') || norm.startsWith('grd') || norm.startsWith('gr')) category = 'grade';
  else if (norm.startsWith('basic')) category = 'basic';
  else if (norm.startsWith('jss') || norm.startsWith('js')) category = 'jss';
  else if (norm.startsWith('sss') || norm.startsWith('ss')) category = 'sss';

  // Extract number and arm: e.g. "primary 4a", "year 4 b", "grade 5", "4a", "jss 1 diamond"
  const match = norm.match(/^(?:primary|pry|p|year|yr|y|grade|grd|gr|basic|jss|js|sss|ss|class)?\s*([0-9]{1,2})\s*([a-z0-9\-_]+)?$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const arm = (match[2] || '').trim().toLowerCase();
    return {
      raw: String(classStr),
      normalized: norm,
      category,
      num,
      arm,
      isAll: false
    };
  }

  return {
    raw: String(classStr),
    normalized: norm,
    category,
    num: null,
    arm: '',
    isAll: false
  };
}

/**
 * Checks if a class schedule item strictly matches a student's specific class.
 *
 * Rules:
 * 1. If student has NO class assigned, returns true.
 * 2. If schedule has NO class assigned or is explicitly marked as 'All Classes', returns true for all students in that school.
 * 3. If student is in 'Primary 4A':
 *    - Matches 'Primary 4A', 'Year 4A', 'Grade 4A', 'Basic 4A', '4A', 'P4A'
 *    - Matches 'Primary 4' (whole class cohort without arms)
 *    - DOES NOT match 'Primary 4B', 'Primary 5', 'Primary 3', or 'Primary 4B - 5B'
 * 4. Multi-class schedules (e.g. classLevels: ['Primary 4A', 'Primary 4B']):
 *    - Matches ONLY if one of the listed classes in the array matches the student's class.
 */
export function isStudentClassMatch(
  studentClassRaw: string | undefined | null,
  scheduleClassLevel?: string | null,
  scheduleClassLevels?: string[] | null
): boolean {
  if (!studentClassRaw || !String(studentClassRaw).trim()) {
    return true; // No student class specified, match all assigned to school
  }

  const studentParsed = parseClassString(studentClassRaw);
  if (studentParsed.isAll || !studentParsed.normalized) {
    return true;
  }

  // Collect candidate schedule classes
  const candidates: string[] = [];
  if (scheduleClassLevel) candidates.push(scheduleClassLevel);
  if (Array.isArray(scheduleClassLevels)) {
    scheduleClassLevels.forEach(lvl => {
      if (lvl) candidates.push(lvl);
    });
  }

  // If schedule has no class specifications at all, it's open to the entire school
  if (candidates.length === 0) {
    return true;
  }

  return candidates.some(candidateRaw => {
    const schedParsed = parseClassString(candidateRaw);
    if (schedParsed.isAll) {
      return true;
    }

    // Direct normalized text match (e.g. "robotics juniors" === "robotics juniors")
    if (schedParsed.normalized === studentParsed.normalized) {
      return true;
    }

    // Number & Arm structural comparison
    if (studentParsed.num !== null && schedParsed.num !== null) {
      // Must be same class number (e.g. 4 and 4)
      if (studentParsed.num !== schedParsed.num) {
        return false;
      }

      // If both have arms specified, arms must match exactly (e.g. 'a' === 'a')
      if (studentParsed.arm && schedParsed.arm) {
        return studentParsed.arm === schedParsed.arm;
      }

      // If schedule does NOT specify an arm (e.g. 'Primary 4' or 'Year 4'),
      // it is a general session for all sections of that class level (4A, 4B, etc.)
      if (!schedParsed.arm) {
        return true;
      }

      // If student has no arm specified and schedule has an arm, it's specific to that arm
      return false;
    }

    // Check if candidate is a range e.g. "Primary 1 - 5" or "Year 1 - Year 5"
    const rangeMatch = schedParsed.normalized.match(/(?:primary|year|grade|basic)?\s*([0-9]+)\s*(?:-|to|–)\s*(?:primary|year|grade|basic)?\s*([0-9]+)/i);
    if (rangeMatch && studentParsed.num !== null) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      if (studentParsed.num >= min && studentParsed.num <= max) {
        return true;
      }
      return false;
    }

    return false;
  });
}
