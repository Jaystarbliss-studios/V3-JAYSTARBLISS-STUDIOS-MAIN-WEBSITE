import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  School, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Plus, 
  ChevronRight, 
  ChevronDown,
  Search, 
  Filter, 
  Radio, 
  Video, 
  ExternalLink,
  BookOpen,
  UserCheck
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { collection, doc, getDocs, updateDoc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { useToast } from '../../contexts/ToastContext';
import { getEffectiveAuth } from '../../utils/impersonation';

interface ScheduleOccurrence {
  id: string;
  scheduleGroupId?: string;
  targetType?: 'SCHOOL' | 'STUDENT' | 'school' | 'student' | 'parent' | 'individual';
  schoolId?: string;
  schoolName?: string;
  studentId?: string;
  studentName?: string;
  parentId?: string;
  programId?: string;
  programName?: string;
  classLevel?: string;
  classLevels?: string[];
  title: string;
  tutorId?: string;
  tutorName?: string;
  meetingLink?: string;
  date: string;
  startDate?: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED' | 'RESCHEDULED';
  absenceReason?: string;
  rescheduleReason?: string;
  rescheduledDate?: string;
  rescheduledStartTime?: string;
  rescheduledEndTime?: string;
  cancellationReason?: string;
  recurring?: boolean;
  occurrenceIndex?: number;
  occurrenceTotal?: number;
}

interface GroupedSession {
  sessionKey: string;
  scheduleGroupId?: string;
  date: string;
  formattedDate: string;
  dayName: string;
  startTime: string;
  endTime: string;
  title: string;
  programName: string;
  programId?: string;
  targetType?: string;
  schoolName?: string;
  studentName?: string;
  tutorName?: string;
  meetingLink?: string;
  overallStatus: string;
  classRangeBadge: string;
  classLevels: string[];
  occurrences: ScheduleOccurrence[];
  isLiveNow: boolean;
  isAutoCompleted: boolean;
}

interface StaffClassSchedulesManagerProps {
  tutorId?: string;
  tutorName?: string;
  assignedSchools?: any[];
  assignedStudents?: any[];
}

export const StaffClassSchedulesManager: React.FC<StaffClassSchedulesManagerProps> = ({
  tutorId,
  tutorName,
  assignedSchools = [],
  assignedStudents = []
}) => {
  const { toast } = useToast();
  const effective = getEffectiveAuth();
  const canUpdateStatus = ['admin', 'tutor', 'staff', 'superadmin'].includes(effective.effectiveRole.toLowerCase());

  const [schedules, setSchedules] = useState<ScheduleOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const [filterTarget, setFilterTarget] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSessionKeys, setExpandedSessionKeys] = useState<Record<string, boolean>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Status Action Modal State
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleOccurrence | null>(null);
  const [actionType, setActionType] = useState<'ONGOING' | 'COMPLETED' | 'ABSENT' | 'RESCHEDULED' | 'CANCELLED' | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSchedules = React.useCallback(async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const currentUid = tutorId || effective.effectiveUid || user?.uid;
      const token = user ? await user.getIdToken() : '';

      let loadedList: ScheduleOccurrence[] = [];
      try {
        const res = await fetch('/.netlify/functions/class-schedules', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.schedules) && data.schedules.length > 0) {
            loadedList = data.schedules;
          }
        }
      } catch {
        // Fallback to Firestore
      }

      if (loadedList.length === 0) {
        const snap = await getDocs(collection(db, 'classSchedules')).catch(() => ({ docs: [] } as any));
        loadedList = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ScheduleOccurrence));
      }

      // Filter by tutor identity if faculty tutor
      const currentName = tutorName || effective.effectiveName || user?.displayName;
      const filtered = loadedList.filter(s => {
        if (!currentUid) return true;
        if (s.tutorId === currentUid) return true;
        if (currentName && s.tutorName && s.tutorName.toLowerCase() === currentName.toLowerCase()) return true;
        return true; // Keep visible in staff workspace
      });

      setSchedules(filtered);
    } catch (err) {
      console.warn('Error fetching class schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [tutorId, tutorName, effective.effectiveUid, effective.effectiveName]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const toggleExpand = (key: string) => {
    setExpandedSessionKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Direct status update handler
  const handleUpdateOccurrenceStatus = async (occurrenceIds: string[], newStatus: string) => {
    if (!canUpdateStatus) {
      toast.error('Only assigned tutors and administrators can update class status.');
      return;
    }
    setUpdatingId(occurrenceIds[0]);
    try {
      const batch = writeBatch(db);
      occurrenceIds.forEach(id => {
        batch.update(doc(db, 'classSchedules', id), {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      toast.success(`Session status updated to ${newStatus}.`);
      await fetchSchedules();
    } catch (e: any) {
      console.error('Update status error:', e);
      toast.error(e.message || 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Detailed status modal submission (for absence, reschedule reason)
  const handleSubmitDetailedAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule || !actionType) return;
    setIsSubmitting(true);
    try {
      const updateData: any = {
        status: actionType,
        updatedAt: serverTimestamp()
      };
      if (actionType === 'ABSENT') updateData.absenceReason = statusReason || 'Marked Absent';
      if (actionType === 'RESCHEDULED') {
        updateData.rescheduleReason = statusReason || 'Class Rescheduled';
        updateData.rescheduledDate = rescheduleDate;
        updateData.rescheduledStartTime = rescheduleStartTime;
        updateData.rescheduledEndTime = rescheduleEndTime;
      }
      if (actionType === 'CANCELLED') updateData.cancellationReason = statusReason || 'Class Cancelled';

      await updateDoc(doc(db, 'classSchedules', selectedSchedule.id), updateData);
      toast.success(`Session status marked as ${actionType}.`);
      setSelectedSchedule(null);
      setActionType(null);
      setStatusReason('');
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group occurrences on each date into unified sessions with range badge & expandable list
  const groupedDaySessions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. Filter raw occurrences
    const filteredRaw = schedules.filter(item => {
      if (filterTarget !== 'ALL') {
        if (item.schoolId !== filterTarget && item.studentId !== filterTarget) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchProg = item.programName?.toLowerCase().includes(q);
        const matchTutor = item.tutorName?.toLowerCase().includes(q);
        const matchSchool = item.schoolName?.toLowerCase().includes(q);
        const matchStudent = item.studentName?.toLowerCase().includes(q);
        const matchClass = item.classLevel?.toLowerCase().includes(q) || (item.classLevels || []).some(c => c.toLowerCase().includes(q));
        if (!matchTitle && !matchProg && !matchTutor && !matchSchool && !matchStudent && !matchClass) return false;
      }
      return true;
    });

    // 2. Group items on each date
    const sessionMap = new Map<string, GroupedSession>();

    filteredRaw.forEach(item => {
      const itemDate = item.date || todayStr;
      const startTime = item.startTime || '09:00';
      const endTime = item.endTime || '10:00';
      const programName = item.programName || item.title || 'Curriculum Session';

      const groupKey = `${itemDate}_${item.scheduleGroupId || `${programName}_${startTime}_${endTime}_${item.schoolName || ''}`}`;

      if (!sessionMap.has(groupKey)) {
        let formattedDate = itemDate;
        let dayName = '';
        try {
          const d = new Date(itemDate + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            formattedDate = d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
            dayName = d.toLocaleDateString('en-NG', { weekday: 'long' });
          }
        } catch {
          // fallback
        }

        sessionMap.set(groupKey, {
          sessionKey: groupKey,
          scheduleGroupId: item.scheduleGroupId,
          date: itemDate,
          formattedDate,
          dayName,
          startTime,
          endTime,
          title: item.title || programName,
          programName,
          programId: item.programId,
          targetType: item.targetType,
          schoolName: item.schoolName,
          studentName: item.studentName,
          tutorName: item.tutorName,
          meetingLink: item.meetingLink,
          overallStatus: item.status || 'SCHEDULED',
          classRangeBadge: item.classLevel || 'All Classes',
          classLevels: [],
          occurrences: [],
          isLiveNow: false,
          isAutoCompleted: false
        });
      }

      const session = sessionMap.get(groupKey)!;
      session.occurrences.push(item);

      if (item.classLevel && !session.classLevels.includes(item.classLevel)) {
        session.classLevels.push(item.classLevel);
      }
      if (Array.isArray(item.classLevels)) {
        item.classLevels.forEach(lvl => {
          if (lvl && !session.classLevels.includes(lvl)) {
            session.classLevels.push(lvl);
          }
        });
      }
    });

    // 3. Post-process sessions to compute accurate class range badge, live state, and auto-completion
    const sessionsList = Array.from(sessionMap.values()).map(sess => {
      sess.classLevels.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (sess.classLevels.length > 1) {
        const first = sess.classLevels[0];
        const last = sess.classLevels[sess.classLevels.length - 1];
        if (sess.classLevels.length >= 3 && first.startsWith('Year') && last.startsWith('Year')) {
          sess.classRangeBadge = `${first} – ${last} (${sess.classLevels.length} Classes)`;
        } else if (sess.classLevels.length >= 3 && first.startsWith('JSS') && last.startsWith('JSS')) {
          sess.classRangeBadge = `${first} – ${last} (${sess.classLevels.length} Classes)`;
        } else {
          sess.classRangeBadge = `${sess.classLevels.join(', ')} (${sess.classLevels.length} Classes)`;
        }
      } else if (sess.classLevels.length === 1) {
        sess.classRangeBadge = sess.classLevels[0];
      }

      // Live & auto-completion check
      const isToday = sess.date === todayStr;
      const isPastDate = sess.date < todayStr;
      const isPastTimeToday = isToday && sess.endTime < currentTimeStr;
      const isCurrentTimeSlot = isToday && sess.startTime <= currentTimeStr && currentTimeStr <= sess.endTime;

      const hasExplicitOngoing = sess.occurrences.some(o => o.status === 'ONGOING');
      const allExplicitCompleted = sess.occurrences.every(o => o.status === 'COMPLETED' || o.status === 'ATTENDED');
      const anyAbsent = sess.occurrences.some(o => o.status === 'ABSENT');
      const anyRescheduled = sess.occurrences.some(o => o.status === 'RESCHEDULED');
      const anyCancelled = sess.occurrences.some(o => o.status === 'CANCELLED');

      if (hasExplicitOngoing || (isCurrentTimeSlot && !allExplicitCompleted && !anyAbsent && !anyCancelled)) {
        sess.overallStatus = 'ONGOING';
        sess.isLiveNow = true;
      } else if (allExplicitCompleted || isPastDate || isPastTimeToday) {
        sess.overallStatus = anyAbsent ? 'ABSENT' : anyRescheduled ? 'RESCHEDULED' : anyCancelled ? 'CANCELLED' : 'COMPLETED';
        sess.isAutoCompleted = isPastDate || isPastTimeToday;
      } else {
        sess.overallStatus = sess.occurrences[0]?.status || 'SCHEDULED';
      }

      return sess;
    });

    // 4. Tab filtering: Upcoming vs History
    const filteredByTab = sessionsList.filter(sess => {
      const isDone = sess.overallStatus === 'COMPLETED' || sess.overallStatus === 'ATTENDED';
      const isPast = sess.date < todayStr && sess.overallStatus !== 'ONGOING';

      if (viewTab === 'UPCOMING') {
        if (sess.overallStatus === 'ONGOING') return true;
        if (isDone || isPast) return false;
        return true;
      } else {
        if (sess.overallStatus === 'ONGOING') return false;
        return isDone || isPast || sess.overallStatus === 'CANCELLED' || sess.overallStatus === 'ABSENT';
      }
    });

    filteredByTab.sort((a, b) => {
      const dateA = `${a.date}T${a.startTime}`;
      const dateB = `${b.date}T${b.startTime}`;
      return viewTab === 'UPCOMING' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });

    // 5. Group by Date Header
    const dateGroups: Array<{ date: string; formattedDate: string; dayName: string; sessions: GroupedSession[] }> = [];

    filteredByTab.forEach(sess => {
      let group = dateGroups.find(g => g.date === sess.date);
      if (!group) {
        group = {
          date: sess.date,
          formattedDate: sess.formattedDate,
          dayName: sess.dayName,
          sessions: []
        };
        dateGroups.push(group);
      }
      group.sessions.push(sess);
    });

    return dateGroups;
  }, [schedules, filterTarget, searchQuery, viewTab]);

  const renderStatusBadge = (status: string, isAutoCompleted = false) => {
    switch (status) {
      case 'ONGOING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white shadow-xs animate-pulse">
            <Radio size={12} className="animate-spin" /> Live In Session
          </span>
        );
      case 'COMPLETED':
      case 'ATTENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <CheckCircle2 size={11} /> {isAutoCompleted ? 'Completed (Ended)' : 'Completed'}
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle size={11} /> Absent
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <RotateCcw size={11} /> Rescheduled
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <AlertCircle size={11} /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            <Clock size={11} /> Scheduled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-red" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Teaching Timetable & Class Schedules
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Combined daily list of school programmes and private learner sessions. Tutors can update attendance statuses and session progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Upcoming vs History Switcher */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewTab('UPCOMING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                viewTab === 'UPCOMING'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Upcoming ({schedules.filter(s => s.status !== 'COMPLETED' && s.status !== 'ATTENDED').length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab('HISTORY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                viewTab === 'HISTORY'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Session History
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filterTarget}
            onChange={e => setFilterTarget(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
          >
            <option value="ALL">All Schools & Learners</option>
            {assignedSchools.map(sch => (
              <option key={sch.id} value={sch.id}>🏫 {sch.name || sch.schoolName}</option>
            ))}
            {assignedStudents.map(st => (
              <option key={st.id} value={st.id}>👤 {st.fullName || st.studentName || st.username}</option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by topic, school, class..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
        </div>
      </div>

      {/* Grouped Chronological Schedule List */}
      {loading ? (
        <div className="text-center py-14 text-xs text-slate-500">
          Loading assigned class schedules...
        </div>
      ) : groupedDaySessions.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Calendar size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
          <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">
            {viewTab === 'UPCOMING' ? 'No upcoming class sessions found' : 'No past schedule history recorded'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {filterTarget === 'ALL'
              ? 'No timetable occurrences currently assigned to your faculty profile.'
              : 'No sessions found for the selected institution or student filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedDaySessions.map(group => (
            <div key={group.date} className="space-y-3">
              {/* Date Header Badge */}
              <div className="flex items-center gap-3">
                <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-800 text-xs font-black tracking-tight inline-flex items-center gap-2 shadow-xs">
                  <Calendar size={14} className="text-brand-red" />
                  <span>{group.dayName ? `${group.dayName}, ` : ''}{group.formattedDate}</span>
                </div>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>

              {/* Day's Consolidated Sessions List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/40">
                {group.sessions.map(session => {
                  const isExpanded = Boolean(expandedSessionKeys[session.sessionKey]);
                  const hasMultipleClasses = session.classLevels.length > 1;

                  return (
                    <div 
                      key={session.sessionKey} 
                      className={`p-4 transition-colors ${
                        session.overallStatus === 'ONGOING' 
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/20' 
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Time & Class Range & Programme Details */}
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          {/* Time Block */}
                          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold shrink-0 text-center min-w-[110px]">
                            <span className="block text-[10px] uppercase text-slate-400 font-sans">TIME</span>
                            {session.startTime} – {session.endTime}
                          </div>

                          <div className="min-w-0">
                            {/* Range Badge, Target Badge, Status Badge */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-50 dark:bg-red-950/40 text-brand-red border border-red-100 dark:border-red-900/30">
                                {session.classRangeBadge}
                              </span>

                              {session.schoolName && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/30 flex items-center gap-1">
                                  <School size={11} /> {session.schoolName}
                                </span>
                              )}

                              {session.studentName && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30 flex items-center gap-1">
                                  <User size={11} /> {session.studentName}
                                </span>
                              )}

                              {renderStatusBadge(session.overallStatus, session.isAutoCompleted)}
                            </div>

                            {/* Title / Programme Name */}
                            <h4 className="text-sm font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
                              {session.title}
                            </h4>

                            {/* Additional metadata row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600 dark:text-slate-300">
                              {session.tutorName && (
                                <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                                  <UserCheck size={12} className="text-emerald-500" /> Tutor: {session.tutorName}
                                </span>
                              )}

                              {session.meetingLink && (
                                <a
                                  href={session.meetingLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-600 font-bold hover:underline inline-flex items-center gap-1 text-[11px]"
                                >
                                  <ExternalLink size={12} /> Live Room
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions: Expand Range Button & Status Controller */}
                        <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0">
                          {hasMultipleClasses && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(session.sessionKey)}
                              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                            >
                              <span>{isExpanded ? 'Hide Cohort Breakdown' : `Expand Range (${session.classLevels.length})`}</span>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}

                          {canUpdateStatus && (
                            <div className="flex items-center gap-1.5">
                              <select
                                disabled={Boolean(updatingId)}
                                value={session.overallStatus}
                                onChange={e => handleUpdateOccurrenceStatus(session.occurrences.map(o => o.id), e.target.value)}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                              >
                                <option value="SCHEDULED">Scheduled</option>
                                <option value="ONGOING">Live Now</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="ABSENT">Mark Absent</option>
                                <option value="RESCHEDULED">Rescheduled</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>

                              {session.occurrences[0] && (
                                <button
                                  type="button"
                                  title="Log absence or reschedule reason"
                                  onClick={() => {
                                    setSelectedSchedule(session.occurrences[0]);
                                    setActionType(session.overallStatus as any);
                                  }}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expandable Breakdown: View each individual class level (Year 1, Year 2, etc.) */}
                      {hasMultipleClasses && isExpanded && (
                        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/60 dark:bg-slate-950/40 p-3.5 rounded-2xl">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            <span>Individual Class Cohort Breakdown ({session.classLevels.length} Classes):</span>
                            {canUpdateStatus && <span className="text-[10px] text-brand-red">Faculty Attendance Controls Active</span>}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {session.classLevels.map((lvl) => {
                              const matchingOcc = session.occurrences.find(o => o.classLevel === lvl);
                              const occStatus = matchingOcc?.status || session.overallStatus;

                              return (
                                <div
                                  key={lvl}
                                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-black bg-red-50 dark:bg-red-950/40 text-brand-red">
                                      {lvl}
                                    </span>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                      {session.title}
                                    </span>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-1.5">
                                    {canUpdateStatus && matchingOcc ? (
                                      <select
                                        value={occStatus}
                                        onChange={e => handleUpdateOccurrenceStatus([matchingOcc.id], e.target.value)}
                                        className="text-[10px] font-bold py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer"
                                      >
                                        <option value="SCHEDULED">Scheduled</option>
                                        <option value="ONGOING">Live</option>
                                        <option value="COMPLETED">Completed</option>
                                        <option value="ABSENT">Absent</option>
                                        <option value="RESCHEDULED">Rescheduled</option>
                                        <option value="CANCELLED">Cancelled</option>
                                      </select>
                                    ) : (
                                      renderStatusBadge(occStatus, session.isAutoCompleted)
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Status Reason Modal (Absent, Reschedule) */}
      {selectedSchedule && actionType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
              Log Session Action: {actionType}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {selectedSchedule.title} • {selectedSchedule.date}
            </p>

            <form onSubmit={handleSubmitDetailedAction} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Status</label>
                <select
                  value={actionType}
                  onChange={e => setActionType(e.target.value as any)}
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="ONGOING">Live Now</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ABSENT">Absent</option>
                  <option value="RESCHEDULED">Rescheduled</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Notes / Reason</label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={e => setStatusReason(e.target.value)}
                  placeholder="Provide reason for attendance status or rescheduling details..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {actionType === 'RESCHEDULED' && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">New Date</label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={e => setRescheduleDate(e.target.value)}
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">New Start Time</label>
                      <input
                        type="time"
                        value={rescheduleStartTime}
                        onChange={e => setRescheduleStartTime(e.target.value)}
                        className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">New End Time</label>
                      <input
                        type="time"
                        value={rescheduleEndTime}
                        onChange={e => setRescheduleEndTime(e.target.value)}
                        className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => { setSelectedSchedule(null); setActionType(null); }}
                  className="min-h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-10 px-5 rounded-xl bg-brand-red hover:bg-red-700 font-bold text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
