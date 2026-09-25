import React, { useCallback, useEffect, useState } from 'react';
import { 
  CalendarDays, CheckCircle2, Clock3, Edit3, Loader2, Plus, 
  RefreshCw, School, Users, User, Trash2, XCircle, Search, Filter 
} from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { db } from '../../lib/firebase';
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, 
  query, where, writeBatch 
} from 'firebase/firestore';
import { useToast } from '../../contexts/ToastContext';

const CLASS_OPTIONS = [
  'Early Years', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
  'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'
];

const STATUS_OPTIONS = ['SCHEDULED', 'COMPLETED', 'ATTENDED', 'ABSENT', 'CANCELLED', 'RESCHEDULED'];

type TargetType = 'school' | 'parent' | 'individual';

interface SchoolItem {
  id: string;
  name: string;
  code?: string;
}

interface ParentItem {
  id: string;
  name: string;
  email: string;
  children: Array<{ id: string; name: string }>;
}

interface IndividualItem {
  id: string;
  name: string;
  email: string;
  track?: string;
}

interface ScheduleOccurrence {
  id: string;
  scheduleGroupId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  tutorName?: string;
  tutorId?: string;
  status: string;
  targetType: TargetType;
  schoolId?: string;
  schoolName?: string;
  classLevel?: string;
  classLevels?: string[];
  parentId?: string;
  parentName?: string;
  parentEmail?: string;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  meetingLink?: string;
}

interface ScheduleGroup {
  scheduleGroupId: string;
  title: string;
  tutorName?: string;
  startTime: string;
  endTime: string;
  targetType: TargetType;
  schoolId?: string;
  schoolName?: string;
  classLevels?: string[];
  parentId?: string;
  parentName?: string;
  studentId?: string;
  studentName?: string;
  occurrences: ScheduleOccurrence[];
}

const inputClass = 'w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500';

const AdminClassSchedules: React.FC = () => {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [parents, setParents] = useState<ParentItem[]>([]);
  const [individuals, setIndividuals] = useState<IndividualItem[]>([]);
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSchool, setFilterSchool] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ScheduleGroup | null>(null);

  // Form State
  const [form, setForm] = useState<{
    targetType: TargetType;
    schoolId: string;
    scope: 'all' | 'range' | 'specific';
    rangeStart: string;
    rangeEnd: string;
    classLevels: string[];
    parentId: string;
    studentId: string;
    title: string;
    tutorName: string;
    meetingLink: string;
    startDate: string;
    startTime: string;
    endTime: string;
    recurring: boolean;
    weeks: string;
  }>({
    targetType: 'school',
    schoolId: '',
    scope: 'all',
    rangeStart: 'Year 1',
    rangeEnd: 'Year 5',
    classLevels: ['Year 1'],
    parentId: '',
    studentId: '',
    title: 'Robotics & Web Engineering Lab',
    tutorName: '',
    meetingLink: '',
    startDate: new Date().toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '12:00',
    recurring: true,
    weeks: '12'
  });

  // Load all schedules and directory data directly from Firestore
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schoolSnap, usersSnap, enrollSnap, indivSnap, studSnap, schedSnap] = await Promise.all([
        getDocs(collection(db, 'schools')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'users')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'enrollment_requests')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'individualStudents')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'students')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'classSchedules')).catch(() => ({ docs: [] } as any))
      ]);

      // 1. Process Schools
      const loadedSchools = schoolSnap.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name || data.schoolName || data.institutionName || d.id),
          code: data.code || data.schoolCode
        };
      }).sort((a: SchoolItem, b: SchoolItem) => a.name.localeCompare(b.name));
      setSchools(loadedSchools);

      // 2. Process Parents and their Children
      const parentMap = new Map<string, ParentItem>();
      usersSnap.docs.forEach((d: any) => {
        const u = d.data();
        if (String(u.role || '').toLowerCase() === 'parent') {
          parentMap.set(d.id, {
            id: d.id,
            name: u.displayName || u.name || (u.email ? u.email.split('@')[0] : 'Parent'),
            email: u.email || '',
            children: []
          });
        }
      });

      // Collect children under parents
      const linkChildToParent = (parentId: string, parentEmail: string, childId: string, childName: string) => {
        let parent = parentMap.get(parentId);
        if (!parent && parentEmail) {
          parent = Array.from(parentMap.values()).find(p => p.email.toLowerCase() === parentEmail.toLowerCase());
        }
        if (parent) {
          if (!parent.children.some(c => c.id === childId)) {
            parent.children.push({ id: childId, name: childName });
          }
        } else if (parentEmail) {
          const newParent: ParentItem = {
            id: parentId || parentEmail,
            name: parentEmail.split('@')[0],
            email: parentEmail,
            children: [{ id: childId, name: childName }]
          };
          parentMap.set(newParent.id, newParent);
        }
      };

      indivSnap.docs.forEach((d: any) => {
        const s = d.data();
        if (s.parentId || s.parentEmail) {
          linkChildToParent(s.parentId, s.parentEmail, d.id, s.fullName || s.studentName || 'Child');
        }
      });
      enrollSnap.docs.forEach((d: any) => {
        const s = d.data();
        if (s.parentId || s.parentEmail || s.email) {
          linkChildToParent(s.parentId, s.parentEmail || s.email, d.id, s.studentName || s.childName || 'Child');
        }
      });
      studSnap.docs.forEach((d: any) => {
        const s = d.data();
        if (!s.schoolId && (s.parentId || s.parentEmail)) {
          linkChildToParent(s.parentId, s.parentEmail, d.id, s.fullName || s.name || 'Child');
        }
      });

      setParents(Array.from(parentMap.values()).sort((a, b) => a.name.localeCompare(b.name)));

      // 3. Process Independent Students
      const indivList: IndividualItem[] = [];
      indivSnap.docs.forEach((d: any) => {
        const s = d.data();
        if (!s.schoolId && !s.parentId && !s.parentEmail) {
          indivList.push({
            id: d.id,
            name: s.fullName || s.studentName || s.username || 'Scholar',
            email: s.email || '',
            track: s.track || s.plan || 'Independent Tech Track'
          });
        }
      });
      setIndividuals(indivList.sort((a, b) => a.name.localeCompare(b.name)));

      // 4. Process Class Schedules occurrences and group them
      const rawOccurrences: ScheduleOccurrence[] = schedSnap.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));

      const groupMap = new Map<string, ScheduleGroup>();

      rawOccurrences.forEach(occ => {
        const groupId = occ.scheduleGroupId || occ.id;
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, {
            scheduleGroupId: groupId,
            title: occ.title || 'Coding Class',
            tutorName: occ.tutorName || '',
            startTime: occ.startTime || '09:00',
            endTime: occ.endTime || '11:00',
            targetType: occ.targetType || (occ.schoolId ? 'school' : occ.parentId ? 'parent' : 'individual'),
            schoolId: occ.schoolId,
            schoolName: occ.schoolName,
            classLevels: occ.classLevels || (occ.classLevel ? [occ.classLevel] : []),
            parentId: occ.parentId,
            parentName: occ.parentName,
            studentId: occ.studentId,
            studentName: occ.studentName,
            occurrences: []
          });
        }
        groupMap.get(groupId)!.occurrences.push(occ);
      });

      // Sort occurrences in each group by date
      const sortedGroups = Array.from(groupMap.values()).map(g => {
        g.occurrences.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        return g;
      });

      setGroups(sortedGroups);
    } catch (e) {
      console.error('Error loading class schedules:', e);
      toast.error(e instanceof Error ? e.message : 'Unable to load schedules.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolvedClasses = () => {
    if (form.scope === 'all') return CLASS_OPTIONS;
    if (form.scope === 'range') {
      const a = CLASS_OPTIONS.indexOf(form.rangeStart);
      const b = CLASS_OPTIONS.indexOf(form.rangeEnd);
      return CLASS_OPTIONS.slice(Math.min(a, b), Math.max(a, b) + 1);
    }
    return form.classLevels;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      targetType: 'school',
      schoolId: filterSchool || (schools[0]?.id || ''),
      scope: 'all',
      rangeStart: 'Year 1',
      rangeEnd: 'Year 5',
      classLevels: ['Year 1'],
      parentId: parents[0]?.id || '',
      studentId: '',
      title: 'Robotics & Software Engineering',
      tutorName: '',
      meetingLink: '',
      startDate: new Date().toISOString().slice(0, 10),
      startTime: '10:00',
      endTime: '12:00',
      recurring: true,
      weeks: '12'
    });
    setShowForm(true);
  };

  const openEdit = (g: ScheduleGroup) => {
    setEditing(g);
    const firstOcc = g.occurrences[0];
    const levels = g.classLevels?.length ? g.classLevels : ['Year 1'];
    setForm({
      targetType: g.targetType || 'school',
      schoolId: g.schoolId || '',
      scope: levels.length === CLASS_OPTIONS.length ? 'all' : 'specific',
      rangeStart: levels[0] || 'Year 1',
      rangeEnd: levels[levels.length - 1] || 'Year 5',
      classLevels: levels,
      parentId: g.parentId || '',
      studentId: g.studentId || '',
      title: g.title || '',
      tutorName: g.tutorName || '',
      meetingLink: firstOcc?.meetingLink || '',
      startDate: firstOcc?.date || new Date().toISOString().slice(0, 10),
      startTime: g.startTime || '09:00',
      endTime: g.endTime || '11:00',
      recurring: g.occurrences.length > 1,
      weeks: String(g.occurrences.length || 12)
    });
    setShowForm(true);
  };

  // Submit and generate occurrences directly in Firestore
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.endTime <= form.startTime) {
      return toast.error('End time must be later than start time.');
    }

    if (form.targetType === 'school' && !form.schoolId) {
      return toast.error('Please select a partner school.');
    }
    if (form.targetType === 'parent' && !form.parentId) {
      return toast.error('Please select a parent account.');
    }
    if (form.targetType === 'individual' && !form.studentId) {
      return toast.error('Please select an independent student.');
    }

    setSaving(true);
    try {
      const selectedSchool = schools.find(s => s.id === form.schoolId);
      const selectedParent = parents.find(p => p.id === form.parentId);
      const selectedIndiv = individuals.find(i => i.id === form.studentId);
      const selectedChild = selectedParent?.children.find(c => c.id === form.studentId);

      const numWeeks = form.recurring ? Math.max(1, Math.min(52, Number(form.weeks) || 12)) : 1;
      const scheduleGroupId = editing?.scheduleGroupId || `grp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const classLevels = form.targetType === 'school' ? resolvedClasses() : [];

      const batch = writeBatch(db);

      // If editing, delete previous occurrences in this group first
      if (editing) {
        for (const occ of editing.occurrences) {
          const ref = doc(db, 'classSchedules', occ.id);
          batch.delete(ref);
        }
      }

      // Generate occurrence dates
      const baseDate = new Date(form.startDate + 'T00:00:00');

      for (let w = 0; w < numWeeks; w++) {
        const occDate = new Date(baseDate);
        occDate.setDate(baseDate.getDate() + (w * 7));
        const dateStr = occDate.toISOString().slice(0, 10);

        if (form.targetType === 'school') {
          // One occurrence per target class level
          for (const lvl of classLevels) {
            const occId = `${scheduleGroupId}-w${w}-${lvl.replace(/\s+/g, '_')}`;
            const occRef = doc(db, 'classSchedules', occId);
            batch.set(occRef, {
              id: occId,
              scheduleGroupId,
              title: form.title,
              tutorName: form.tutorName,
              meetingLink: form.meetingLink,
              startTime: form.startTime,
              endTime: form.endTime,
              date: dateStr,
              status: 'SCHEDULED',
              targetType: 'school',
              schoolId: form.schoolId,
              schoolName: selectedSchool?.name || 'Partner School',
              classLevel: lvl,
              classLevels,
              occurrenceIndex: w + 1,
              occurrenceTotal: numWeeks,
              createdAt: new Date().toISOString()
            });
          }
        } else if (form.targetType === 'parent') {
          const occId = `${scheduleGroupId}-w${w}`;
          const occRef = doc(db, 'classSchedules', occId);
          batch.set(occRef, {
            id: occId,
            scheduleGroupId,
            title: form.title,
            tutorName: form.tutorName,
            meetingLink: form.meetingLink,
            startTime: form.startTime,
            endTime: form.endTime,
            date: dateStr,
            status: 'SCHEDULED',
            targetType: 'parent',
            parentId: form.parentId,
            parentName: selectedParent?.name || 'Parent',
            parentEmail: selectedParent?.email || '',
            studentId: form.studentId || undefined,
            studentName: selectedChild?.name || 'Child',
            occurrenceIndex: w + 1,
            occurrenceTotal: numWeeks,
            createdAt: new Date().toISOString()
          });
        } else {
          // Individual Cadet
          const occId = `${scheduleGroupId}-w${w}`;
          const occRef = doc(db, 'classSchedules', occId);
          batch.set(occRef, {
            id: occId,
            scheduleGroupId,
            title: form.title,
            tutorName: form.tutorName,
            meetingLink: form.meetingLink,
            startTime: form.startTime,
            endTime: form.endTime,
            date: dateStr,
            status: 'SCHEDULED',
            targetType: 'individual',
            studentId: form.studentId,
            studentName: selectedIndiv?.name || 'Scholar',
            studentEmail: selectedIndiv?.email || '',
            occurrenceIndex: w + 1,
            occurrenceTotal: numWeeks,
            createdAt: new Date().toISOString()
          });
        }
      }

      await batch.commit();

      toast.success(editing ? 'Class schedule updated successfully.' : `Schedule generated for ${numWeeks} week(s).`);
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      console.error('Save schedule error:', err);
      toast.error(err instanceof Error ? err.message : 'Unable to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  // Update status of single occurrence directly in Firestore
  const setStatus = async (occId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'classSchedules', occId), { status: newStatus });
      setGroups(prev => prev.map(g => ({
        ...g,
        occurrences: g.occurrences.map(s => s.id === occId ? { ...s, status: newStatus } : s)
      })));
      toast.success(`Session status updated to ${newStatus}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to update session status.');
    }
  };

  // Delete entire recurring series
  const deleteGroup = async (g: ScheduleGroup) => {
    if (!window.confirm(`Are you sure you want to delete the schedule group "${g.title}" (${g.occurrences.length} sessions)?`)) {
      return;
    }
    try {
      const batch = writeBatch(db);
      for (const occ of g.occurrences) {
        batch.delete(doc(db, 'classSchedules', occ.id));
      }
      await batch.commit();
      toast.success('Schedule group removed.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to delete schedule.');
    }
  };

  // Filter groups
  const filteredGroups = groups.filter(g => {
    if (filterType !== 'all' && g.targetType !== filterType) return false;
    if (filterSchool && g.schoolId !== filterSchool) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = g.title?.toLowerCase().includes(q);
      const matchSchool = g.schoolName?.toLowerCase().includes(q);
      const matchParent = g.parentName?.toLowerCase().includes(q);
      const matchStudent = g.studentName?.toLowerCase().includes(q);
      const matchTutor = g.tutorName?.toLowerCase().includes(q);
      return matchTitle || matchSchool || matchParent || matchStudent || matchTutor;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <SEO title="Class Schedules & Timetable Hub | Admin" description="Create dynamic recurring schedules for partner schools, parents, and individual scholars." noindex={true} />

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-red text-white">
            Live Ecosystem Timetable
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
            Class &amp; Lab Schedules
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Schedule recurring class sessions for partner schools, parents with enrolled children, or independent learners. Schedules synchronize directly to student, parent, and school dashboards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-11 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 text-xs font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="min-h-11 rounded-2xl bg-brand-red hover:bg-red-700 text-white px-5 text-xs font-black inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus size={15} />
            <span>Create Schedule</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search schedules by title, school, parent, tutor..."
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Audiences</option>
            <option value="school">Partner Schools</option>
            <option value="parent">Parents &amp; Children</option>
            <option value="individual">Independent Scholars</option>
          </select>

          {filterType === 'school' && (
            <select
              value={filterSchool}
              onChange={e => setFilterSchool(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All Schools</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Create / Edit Schedule Form Modal */}
      {showForm && (
        <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {editing ? 'Edit Recurring Schedule Group' : 'Create New Class Schedule'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure schedule audience, weekly recurrence, timetable, and curriculum topic.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditing(null); }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <XCircle size={20} />
            </button>
          </div>

          {/* Audience Selection Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
              Select Schedule Audience
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, targetType: 'school' }))}
                className={`py-3 px-4 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  form.targetType === 'school'
                    ? 'border-brand-red bg-red-50/50 text-brand-red dark:bg-red-950/30'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <School size={16} />
                <span>Partner School</span>
              </button>

              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, targetType: 'parent' }))}
                className={`py-3 px-4 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  form.targetType === 'parent'
                    ? 'border-sky-500 bg-sky-50/50 text-sky-600 dark:bg-sky-950/30'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Users size={16} />
                <span>Parent &amp; Child</span>
              </button>

              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, targetType: 'individual' }))}
                className={`py-3 px-4 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  form.targetType === 'individual'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-600 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <User size={16} />
                <span>Independent Scholar</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Target-Specific Selectors */}
            {form.targetType === 'school' && (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Partner School
                  </label>
                  <select
                    value={form.schoolId}
                    onChange={e => setForm({ ...form, schoolId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Select partner school...</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Class Level Scope
                  </label>
                  <select
                    value={form.scope}
                    onChange={e => setForm({ ...form, scope: e.target.value as any })}
                    className={inputClass}
                  >
                    <option value="all">All Classes in School</option>
                    <option value="range">Class Range</option>
                    <option value="specific">Specific Classes</option>
                  </select>
                </div>

                {form.scope === 'range' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">From</label>
                      <select
                        value={form.rangeStart}
                        onChange={e => setForm({ ...form, rangeStart: e.target.value })}
                        className={inputClass}
                      >
                        {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">To</label>
                      <select
                        value={form.rangeEnd}
                        onChange={e => setForm({ ...form, rangeEnd: e.target.value })}
                        className={inputClass}
                      >
                        {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {form.scope === 'specific' && (
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Choose Classes
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50 dark:bg-slate-950">
                      {CLASS_OPTIONS.map(c => (
                        <label key={c} className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.classLevels.includes(c)}
                            onChange={e => setForm(f => ({
                              ...f,
                              classLevels: e.target.checked
                                ? Array.from(new Set([...f.classLevels, c]))
                                : f.classLevels.filter(x => x !== c)
                            }))}
                            className="rounded border-slate-300 text-brand-red focus:ring-brand-red"
                          />
                          <span>{c}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {form.targetType === 'parent' && (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Select Parent Account
                  </label>
                  <select
                    value={form.parentId}
                    onChange={e => {
                      const p = parents.find(x => x.id === e.target.value);
                      setForm({
                        ...form,
                        parentId: e.target.value,
                        studentId: p?.children[0]?.id || ''
                      });
                    }}
                    className={inputClass}
                  >
                    <option value="">Select parent...</option>
                    {parents.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Select Child / Cadet
                  </label>
                  <select
                    value={form.studentId}
                    onChange={e => setForm({ ...form, studentId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">All children / General Family</option>
                    {(parents.find(p => p.id === form.parentId)?.children || []).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {form.targetType === 'individual' && (
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Independent Scholar
                </label>
                <select
                  value={form.studentId}
                  onChange={e => setForm({ ...form, studentId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select scholar...</option>
                  {individuals.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.email}) • {i.track}</option>
                  ))}
                </select>
              </div>
            )}

            {/* General Class Details */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Class / Programme Topic
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className={inputClass}
                placeholder="e.g. Python Web Engineering & AI"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Instructor / Faculty Mentor
              </label>
              <input
                type="text"
                value={form.tutorName}
                onChange={e => setForm({ ...form, tutorName: e.target.value })}
                className={inputClass}
                placeholder="Assigned tutor name"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Virtual Room / Meeting Link (Optional)
              </label>
              <input
                type="url"
                value={form.meetingLink}
                onChange={e => setForm({ ...form, meetingLink: e.target.value })}
                className={inputClass}
                placeholder="https://meet.google.com/..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                First Class Date
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm({ ...form, startTime: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                End Time
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm({ ...form, endTime: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Recurrence
              </label>
              <select
                value={form.recurring ? 'yes' : 'no'}
                onChange={e => setForm({ ...form, recurring: e.target.value === 'yes' })}
                className={inputClass}
              >
                <option value="yes">Repeats Weekly</option>
                <option value="no">Single One-Time Session</option>
              </select>
            </div>

            {form.recurring && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Number of Weeks (Term Length)
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={form.weeks}
                  onChange={e => setForm({ ...form, weeks: e.target.value })}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditing(null); }}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-brand-red hover:bg-red-700 text-white text-xs font-black inline-flex items-center gap-2 shadow-sm transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />}
              <span>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Generate Schedule'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Schedules List View */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
            <Loader2 className="animate-spin mx-auto mb-2 text-brand-red" size={24} />
            <span>Loading class schedules from live database...</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800 space-y-3">
            <CalendarDays className="mx-auto text-slate-300 dark:text-slate-700" size={36} />
            <h3 className="font-black text-slate-900 dark:text-white text-base">No active class schedules found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Create a recurring schedule for partner schools, enrolled parent children, or independent learners to publish live class sessions.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 rounded-xl bg-brand-red text-white text-xs font-black inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Create First Schedule
            </button>
          </div>
        ) : (
          filteredGroups.map(g => {
            const firstOcc = g.occurrences[0];
            const isSchool = g.targetType === 'school';
            const isParent = g.targetType === 'parent';

            return (
              <div
                key={g.scheduleGroupId}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {isSchool && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-50 dark:bg-red-950/40 text-brand-red">
                          <School size={11} /> {g.schoolName || 'Partner School'}
                        </span>
                      )}
                      {isParent && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                          <Users size={11} /> Parent: {g.parentName || 'Parent Account'} {g.studentName ? `• Child: ${g.studentName}` : ''}
                        </span>
                      )}
                      {!isSchool && !isParent && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                          <User size={11} /> Scholar: {g.studentName || 'Independent Cadet'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1.5">
                      {g.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span><strong>Tutor:</strong> {g.tutorName || 'Unassigned'}</span>
                      <span><strong>Time:</strong> {g.startTime} – {g.endTime}</span>
                      <span><strong>Total Occurrences:</strong> {g.occurrences.length} sessions</span>
                      {firstOcc?.meetingLink && (
                        <a
                          href={firstOcc.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 font-bold hover:underline"
                        >
                          Virtual Room Link
                        </a>
                      )}
                    </p>

                    {isSchool && g.classLevels && g.classLevels.length > 0 && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                        <strong>Target Classes:</strong> {g.classLevels.length === CLASS_OPTIONS.length ? 'All classes in school' : g.classLevels.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(g)}
                      className="min-h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
                    >
                      <Edit3 size={13} />
                      <span>Edit Series</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteGroup(g)}
                      className="min-h-9 px-3 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold inline-flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Occurrence Table */}
                <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800 pt-3">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead>
                      <tr className="text-slate-400 uppercase font-black text-[10px]">
                        <th className="py-2 px-3">Session Date</th>
                        <th className="py-2 px-3">Target / Class</th>
                        <th className="py-2 px-3">Time</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Update Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {g.occurrences.slice(0, 25).map(occ => (
                        <tr key={occ.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-mono">
                            {new Date(occ.date + 'T00:00:00').toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                            {occ.classLevel || occ.studentName || occ.parentName || 'Cadet'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            <Clock3 size={11} className="inline mr-1 text-slate-400" />
                            {occ.startTime} – {occ.endTime}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                              occ.status === 'COMPLETED' || occ.status === 'ATTENDED'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : occ.status === 'CANCELLED' || occ.status === 'ABSENT'
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {occ.status === 'COMPLETED' || occ.status === 'ATTENDED' ? <CheckCircle2 size={10} /> : <Clock3 size={10} />}
                              {occ.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <select
                              value={occ.status}
                              onChange={e => void setStatus(occ.id, e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                            >
                              {STATUS_OPTIONS.map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {g.occurrences.length > 25 && (
                    <p className="text-[11px] text-slate-400 mt-2 italic">
                      Showing first 25 occurrences in this recurring timetable.
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminClassSchedules;
