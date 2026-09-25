import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  UserCheck, 
  Users, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Radio, 
  AlertCircle, 
  RotateCcw, 
  XCircle, 
  Filter, 
  History, 
  Search, 
  GraduationCap,
  Sparkles,
  School,
  Video,
  PlayCircle
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { getEffectiveAuth } from '../../utils/impersonation';

export interface ClassScheduleItem {
  id: string;
  scheduleGroupId?: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  tutorName?: string;
  tutorId?: string;
  status: string;
  schoolId?: string;
  schoolName?: string;
  programId?: string;
  programName?: string;
  classLevel?: string;
  classLevels?: string[];
  meetingLink?: string;
  absenceReason?: string;
  rescheduleReason?: string;
  rescheduledDate?: string;
  cancellationReason?: string;
}

export interface SchoolProgramItem {
  id: string;
  name: string;
  description?: string;
  level?: string;
  schedule?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  durationMode?: 'fixed_dates' | 'admin_controlled';
  completedAt?: string;
  assignedTutors?: Array<{
    tutorId: string;
    tutorName: string;
    role?: string;
  }>;
  isGeneralProgram?: boolean;
  hasEdclub?: boolean;
  hasResources?: boolean;
}

export interface GroupedSession {
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
  tutorName?: string;
  meetingLink?: string;
  overallStatus: string;
  classRangeBadge: string;
  classLevels: string[];
  occurrences: ClassScheduleItem[];
  isLiveNow: boolean;
  isAutoCompleted: boolean;
}

interface SchoolClassScheduleTimelineProps {
  schoolId: string;
  schoolName: string;
  programs: SchoolProgramItem[];
  schedules: ClassScheduleItem[];
  onRefresh?: () => void;
  readOnly?: boolean;
}

export const SchoolClassScheduleTimeline: React.FC<SchoolClassScheduleTimelineProps> = ({
  schoolId: _schoolId,
  schoolName,
  programs = [],
  schedules = [],
  onRefresh,
  readOnly = false
}) => {
  const { toast } = useToast();
  const effective = getEffectiveAuth();
  
  // Can current user update status? (Only Tutors, Staff, and Admins can update status. School Admin & Students are Read-Only)
  const canManageStatus = !readOnly && ['admin', 'tutor', 'staff', 'superadmin'].includes(effective.effectiveRole.toLowerCase());

  const [selectedProgramId, setSelectedProgramId] = useState<string>('ALL');
  const [viewTab, setViewTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [expandedSessionKeys, setExpandedSessionKeys] = useState<Record<string, boolean>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(value => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Status update handler for authorized Tutors and Admins
  const handleUpdateStatus = async (occurrenceIds: string[], newStatus: string) => {
    if (!canManageStatus) {
      toast.error('Only assigned tutors and platform administrators can update class session status.');
      return;
    }
    const targetId = occurrenceIds[0];
    setUpdatingId(targetId);
    try {
      await Promise.all(occurrenceIds.map(id => 
        updateDoc(doc(db, 'classSchedules', id), {
          status: newStatus,
          updatedAt: serverTimestamp()
        })
      ));
      toast.success(`Class session status marked as ${newStatus}.`);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error('Update status error:', e);
      toast.error(e instanceof Error ? e.message : 'Unable to update session status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedSessionKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Separate active vs historical programs
  const activePrograms = useMemo(() => {
    return programs.filter(p => p.status !== 'COMPLETED' && p.status !== 'HISTORICAL');
  }, [programs]);

  // Aggregate and collapse individual class occurrences for each time slot on that day into ONE unified session entry
  const groupedDaySessions = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. First filter by selected programme and search query
    const filteredRaw = schedules.filter(item => {
      // Program filter
      if (selectedProgramId !== 'ALL') {
        const matchProgId = item.programId === selectedProgramId;
        const selectedProg = programs.find(p => p.id === selectedProgramId);
        const matchProgName = selectedProg?.name && item.programName && item.programName.toLowerCase() === selectedProg.name.toLowerCase();
        const matchTitle = selectedProg?.name && item.title && item.title.toLowerCase().includes(selectedProg.name.toLowerCase());
        if (!matchProgId && !matchProgName && !matchTitle) return false;
      }

      // Class filter
      if (selectedClassFilter !== 'ALL') {
        const itemClasses = item.classLevels?.length ? item.classLevels : [item.classLevel || ''];
        if (!itemClasses.some(c => c.toLowerCase() === selectedClassFilter.toLowerCase())) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchTutor = item.tutorName?.toLowerCase().includes(q);
        const matchClass = item.classLevel?.toLowerCase().includes(q) || (item.classLevels || []).some(c => c.toLowerCase().includes(q));
        const matchDate = item.date?.toLowerCase().includes(q);
        if (!matchTitle && !matchTutor && !matchClass && !matchDate) return false;
      }

      return true;
    });

    // 2. Group items on each date by timetable slot / scheduleGroupId
    const sessionMap = new Map<string, GroupedSession>();

    filteredRaw.forEach(item => {
      const itemDate = item.date || todayStr;
      const startTime = item.startTime || '09:00';
      const endTime = item.endTime || '10:00';
      const programName = item.programName || item.title || 'Curriculum Session';
      
      // Grouping key: Same date + (scheduleGroupId OR same program + time + tutor)
      const groupKey = `${itemDate}_${item.scheduleGroupId || `${programName}_${startTime}_${endTime}_${item.tutorName || ''}`}`;

      if (!sessionMap.has(groupKey)) {
        let formattedDate = itemDate;
        let dayName = '';
        try {
          const d = new Date(itemDate + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            const day = d.getDate();
            const suffix = day % 10 === 1 && day % 100 !== 11 ? 'st' : day % 10 === 2 && day % 100 !== 12 ? 'nd' : day % 10 === 3 && day % 100 !== 13 ? 'rd' : 'th';
            dayName = d.toLocaleDateString('en-NG', { weekday: 'long' });
            formattedDate = `${dayName}, ${day}${suffix} ${d.toLocaleDateString('en-NG', { month: 'long' })} ${d.getFullYear()}`;
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

      // Collect all class levels
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
      // Natural sort class levels (Year 1, Year 2, ... Year 5, JSS 1, etc.)
      sess.classLevels.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      // Format Class Range Badge (e.g. "Year 1 – Year 5" or "Year 1, Year 2" or "All Classes")
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

      // Check live status
      const isToday = sess.date === todayStr;
      const isPastDate = sess.date < todayStr;
      const isPastTimeToday = isToday && sess.endTime < currentTimeStr;
      const isCurrentTimeSlot = isToday && sess.startTime <= currentTimeStr && currentTimeStr <= sess.endTime;

      const allExplicitCompleted = sess.occurrences.every(o => o.status === 'COMPLETED' || o.status === 'ATTENDED');
      const anyAbsent = sess.occurrences.some(o => o.status === 'ABSENT');
      const anyRescheduled = sess.occurrences.some(o => o.status === 'RESCHEDULED');
      const anyCancelled = sess.occurrences.some(o => o.status === 'CANCELLED');

      if (isCurrentTimeSlot && !allExplicitCompleted && !anyAbsent && !anyCancelled && !anyRescheduled) {
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

    // 4. Separate Upcoming vs History according to tab
    const filteredByTab = sessionsList.filter(sess => {
      const isDone = sess.overallStatus === 'COMPLETED' || sess.overallStatus === 'ATTENDED';
      const isPast = sess.date < todayStr && sess.overallStatus !== 'ONGOING';

      if (viewTab === 'UPCOMING') {
        // Upcoming tab: show active sessions that are not past completed
        if (sess.overallStatus === 'ONGOING') return true;
        if (isDone || isPast) return false;
        return true;
      } else {
        // History tab: show completed, past, cancelled, absent sessions
        if (sess.overallStatus === 'ONGOING') return false;
        return isDone || isPast || sess.overallStatus === 'CANCELLED' || sess.overallStatus === 'ABSENT';
      }
    });

    // Sort: upcoming = earliest -> latest; history = latest -> earliest
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
  }, [schedules, selectedProgramId, programs, selectedClassFilter, searchQuery, viewTab]);

  // Find currently live session for prominent banner
  const liveSession = useMemo(() => {
    for (const group of groupedDaySessions) {
      const found = group.sessions.find(s => s.overallStatus === 'ONGOING' || s.isLiveNow);
      if (found) return found;
    }
    return null;
  }, [groupedDaySessions]);

  // Find next upcoming session
  const nextSession = useMemo(() => {
    if (viewTab !== 'UPCOMING') return null;
    for (const group of groupedDaySessions) {
      const found = group.sessions.find(s => s.overallStatus === 'SCHEDULED' && !s.isLiveNow);
      if (found) return found;
    }
    return null;
  }, [groupedDaySessions, viewTab]);

  const renderStatusBadge = (status: string, isAutoCompleted = false) => {
    switch (status) {
      case 'ONGOING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white shadow-xs animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            Live Now / In Session
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
      {/* 🔴 SECTION 1: PROMINENT LIVE / ONGOING CLASS BANNER (If Active) */}
      {liveSession && (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white p-6 border-2 border-emerald-500/50 shadow-lg shadow-emerald-950/30">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider animate-pulse">
                  <Radio size={13} className="animate-spin" /> LIVE CLASS IN SESSION
                </span>
                <span className="text-xs text-emerald-300 font-bold">
                  {liveSession.dayName ? `${liveSession.dayName}, ` : ''}{liveSession.formattedDate}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {liveSession.title}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300">
                <span className="font-bold text-white bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  Cohort: {liveSession.classRangeBadge}
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  ⏰ {liveSession.startTime} – {liveSession.endTime}
                </span>
                {liveSession.tutorName && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                    <UserCheck size={14} /> Assigned Faculty: {liveSession.tutorName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {liveSession.meetingLink && (
                <a
                  href={liveSession.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black inline-flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Video size={16} />
                  <span>Join Live Classroom</span>
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 2: PROGRAMME SELECTION & TIMETABLE HEADER */}
      <div className="bg-white dark:bg-[#161B26] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-brand-red/10 text-brand-red">
                <Calendar size={18} />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Institutional Class Timetable &amp; Schedule
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a programme below to view its single-list daily schedule, cohort ranges, assigned faculty, and session statuses for {schoolName}.
                </p>
              </div>
            </div>
          </div>

          {/* View Tab Switcher: Upcoming vs History */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewTab('UPCOMING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                viewTab === 'UPCOMING'
                  ? 'bg-white dark:bg-slate-800 text-brand-red shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock size={13} />
              <span>Upcoming &amp; Active</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('HISTORY')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                viewTab === 'HISTORY'
                  ? 'bg-white dark:bg-slate-800 text-brand-red shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History size={13} />
              <span>Schedule History</span>
            </button>
          </div>
        </div>

        {/* Assigned Programmes Selector Cards */}
        <div>
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2.5">
            1. Select Assigned Programme Track:
          </label>

          {activePrograms.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
              No active programmes currently configured for {schoolName}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* All Programmes Card */}
              <button
                type="button"
                onClick={() => setSelectedProgramId('ALL')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  selectedProgramId === 'ALL'
                    ? 'border-brand-red bg-red-50/40 dark:bg-red-950/30 ring-2 ring-brand-red/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    All Tracks
                  </span>
                  <span className="text-[11px] font-bold text-brand-red">
                    {schedules.length} Sessions
                  </span>
                </div>
                <h4 className="font-black text-xs text-slate-900 dark:text-white mt-2">
                  All School Programmes
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Complete timetable across all curriculum cohorts
                </p>
              </button>

              {/* Individual Programme Cards */}
              {activePrograms.map(prog => {
                const isSelected = selectedProgramId === prog.id;
                const progSchedules = schedules.filter(s => 
                  s.programId === prog.id || 
                  (prog.name && s.programName && s.programName.toLowerCase() === prog.name.toLowerCase()) ||
                  (prog.name && s.title && s.title.toLowerCase().includes(prog.name.toLowerCase()))
                );

                const leadTutor = prog.assignedTutors?.[0]?.tutorName;

                return (
                  <button
                    key={prog.id}
                    type="button"
                    onClick={() => setSelectedProgramId(prog.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-brand-red bg-red-50/40 dark:bg-red-950/30 ring-2 ring-brand-red/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {prog.status || 'Active'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {progSchedules.length} Classes
                      </span>
                    </div>

                    <h4 className="font-black text-xs text-slate-900 dark:text-white mt-2 line-clamp-1">
                      {prog.name}
                    </h4>

                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      {prog.level || 'Year 1 - Year 5'}
                    </p>

                    {leadTutor && (
                      <div className="mt-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <UserCheck size={11} className="text-brand-red" />
                        <span className="truncate">Tutor: {leadTutor}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: UNIFIED CHRONOLOGICAL SCHEDULE LIST */}
      <div className="bg-white dark:bg-[#161B26] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap size={16} className="text-brand-red" />
              <span>
                {selectedProgramId === 'ALL'
                  ? 'All Class Schedules'
                  : `Class Schedule for ${programs.find(p => p.id === selectedProgramId)?.name || 'Selected Programme'}`}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {groupedDaySessions.reduce((acc, g) => acc + g.sessions.length, 0)} {viewTab === 'UPCOMING' ? 'upcoming' : 'historical'} sessions
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Daily combined list: all classes for that timetable slot are consolidated into one row with expandable cohort breakdown.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter by topic, tutor..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
          </div>
        </div>

        {/* Chronological List of Date Groups */}
        {groupedDaySessions.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <Calendar size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">
              {viewTab === 'UPCOMING' ? 'No upcoming class schedules found' : 'No past schedule history found'}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {selectedProgramId === 'ALL'
                ? 'No timetable entries have been scheduled for this school.'
                : 'No sessions are currently scheduled for the selected programme track.'}
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
                              {/* Range Badge, Programme Badge, Status Badge */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-50 dark:bg-red-950/40 text-brand-red border border-red-100 dark:border-red-900/30">
                                  {session.classRangeBadge}
                                </span>
                                
                                {session.programName && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {session.programName}
                                  </span>
                                )}

                                {renderStatusBadge(session.overallStatus, session.isAutoCompleted)}
                              </div>

                              {/* Title / Programme Name */}
                              <h4 className="text-sm font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
                                {session.title}
                              </h4>

                              {/* Tutor Assignment Row */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600 dark:text-slate-300">
                                <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                                  <UserCheck size={13} className="text-emerald-500 shrink-0" />
                                  <span>Assigned Tutor:</span>
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black">
                                    {session.tutorName || 'Faculty Instructor Assigned'}
                                  </span>
                                </span>

                                {session.meetingLink && (
                                  <a
                                    href={session.meetingLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sky-600 font-bold hover:underline inline-flex items-center gap-1 text-[11px]"
                                  >
                                    <ExternalLink size={12} /> Virtual Room
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions: Expand Range Button & Status Controller (if Tutor/Admin) */}
                          <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0">
                            {hasMultipleClasses && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(session.sessionKey)}
                                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
                              >
                                <span>{isExpanded ? 'Hide Cohort Breakdown' : `Expand Range (${session.classLevels.length})`}</span>
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}

                            {/* Tutors & Admins can update status; School Admin and Students see Display Badge */}
                            {canManageStatus ? (
                              <select
                                disabled={Boolean(updatingId)}
                                value={session.overallStatus}
                                onChange={e => handleUpdateStatus(session.occurrences.map(o => o.id), e.target.value)}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                              >
                                <option value="SCHEDULED">Scheduled</option>
                                <option value="ONGOING">Live Now</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="ABSENT">Absent</option>
                                <option value="RESCHEDULED">Rescheduled</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>
                            ) : null}
                          </div>
                        </div>

                        {/* Expandable Breakdown: View each individual class level (Year 1, Year 2, etc.) */}
                        {hasMultipleClasses && isExpanded && (
                          <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/60 dark:bg-slate-950/40 p-3.5 rounded-2xl">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                              <span>Individual Class Cohort Breakdown ({session.classLevels.length} Classes):</span>
                              {canManageStatus && <span className="text-[10px] text-slate-400">Tutor Status Control Active</span>}
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
                                      {canManageStatus && matchingOcc ? (
                                        <select
                                          value={occStatus}
                                          onChange={e => handleUpdateStatus([matchingOcc.id], e.target.value)}
                                          className="text-[10px] font-bold py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
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
      </div>
    </div>
  );
};

export default SchoolClassScheduleTimeline;
