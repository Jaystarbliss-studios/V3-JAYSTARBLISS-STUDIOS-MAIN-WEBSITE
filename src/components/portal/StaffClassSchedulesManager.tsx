import React, { useState, useEffect } from 'react';
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
  Search, 
  Filter, 
  Radio, 
  Video, 
  PlayCircle,
  FileText
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { useToast } from '../../contexts/ToastContext';

interface ScheduleOccurrence {
  id: string;
  scheduleGroupId?: string;
  targetType?: 'SCHOOL' | 'STUDENT';
  schoolId?: string;
  schoolName?: string;
  studentId?: string;
  studentName?: string;
  parentId?: string;
  classLevel?: string;
  classLevels?: string[];
  title: string;
  tutorId?: string;
  tutorName?: string;
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
  occurrenceNumber?: number;
  occurrenceTotal?: number;
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
  const [schedules, setSchedules] = useState<ScheduleOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recurring' | 'upcoming' | 'rescheduled'>('upcoming');
  const [filterTarget, setFilterTarget] = useState<string>('ALL');

  // Status Action Modal State
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleOccurrence | null>(null);
  const [actionType, setActionType] = useState<'ONGOING' | 'COMPLETED' | 'ABSENT' | 'RESCHEDULED' | 'CANCELLED' | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Schedule Creation Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTargetType, setCreateTargetType] = useState<'SCHOOL' | 'STUDENT'>('SCHOOL');
  const [createSchoolId, setCreateSchoolId] = useState('');
  const [createStudentId, setCreateStudentId] = useState('');
  const [createClassLevel, setCreateClassLevel] = useState('JSS 1');
  const [createTitle, setCreateTitle] = useState('');
  const [createStartDate, setCreateStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [createStartTime, setCreateStartTime] = useState('10:00');
  const [createEndTime, setCreateEndTime] = useState('11:30');
  const [createWeeks, setCreateWeeks] = useState(12);
  const [createRecurring, setCreateRecurring] = useState(true);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const currentUid = tutorId || user?.uid;
      const token = user ? await user.getIdToken() : '';

      const res = await fetch('/.netlify/functions/class-schedules', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      } else {
        // Fallback to direct Firestore collection
        const snap = await getDocs(collection(db, 'classSchedules'));
        const directList = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleOccurrence));
        const filtered = directList.filter(s => {
          if (!currentUid) return true;
          return s.tutorId === currentUid || s.tutorName === tutorName;
        });
        setSchedules(filtered);
      }
    } catch (err) {
      console.warn('Error fetching class schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [tutorId]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule || !actionType) return;
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';

      const payload: any = {
        scheduleId: selectedSchedule.id,
        status: actionType,
        reason: statusReason
      };

      if (actionType === 'ABSENT') {
        payload.absenceReason = statusReason || 'Tutor / Scholar marked absent';
      } else if (actionType === 'RESCHEDULED') {
        payload.rescheduleReason = statusReason || 'Class rescheduled';
        payload.rescheduledDate = rescheduleDate;
        payload.rescheduledStartTime = rescheduleStartTime;
        payload.rescheduledEndTime = rescheduleEndTime;
      } else if (actionType === 'CANCELLED') {
        payload.cancellationReason = statusReason || 'Class cancelled';
      }

      const res = await fetch('/.netlify/functions/class-schedules', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(`Class status updated to ${actionType}.`);
      } else {
        // Direct Firestore fallback
        const updateData: any = {
          status: actionType,
          updatedAt: serverTimestamp()
        };
        if (actionType === 'ABSENT') updateData.absenceReason = statusReason;
        if (actionType === 'RESCHEDULED') {
          updateData.rescheduleReason = statusReason;
          updateData.rescheduledDate = rescheduleDate;
          updateData.rescheduledStartTime = rescheduleStartTime;
          updateData.rescheduledEndTime = rescheduleEndTime;
        }
        if (actionType === 'CANCELLED') updateData.cancellationReason = statusReason;

        await updateDoc(doc(db, 'classSchedules', selectedSchedule.id), updateData);
        toast.success(`Class status recorded.`);
      }

      setSelectedSchedule(null);
      setActionType(null);
      setStatusReason('');
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update class schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';
      const currentUid = tutorId || user?.uid;
      const currentName = tutorName || user?.displayName || 'Faculty Tutor';

      let targetSchoolName = '';
      if (createTargetType === 'SCHOOL') {
        const found = assignedSchools.find(s => s.id === createSchoolId);
        targetSchoolName = found?.name || 'Assigned School';
      }

      let targetStudentName = '';
      if (createTargetType === 'STUDENT') {
        const found = assignedStudents.find(s => s.id === createStudentId);
        targetStudentName = found?.fullName || found?.studentName || 'Private Student';
      }

      const payload = {
        targetType: createTargetType,
        schoolId: createTargetType === 'SCHOOL' ? createSchoolId : undefined,
        schoolName: createTargetType === 'SCHOOL' ? targetSchoolName : undefined,
        classLevels: createTargetType === 'SCHOOL' ? [createClassLevel] : undefined,
        studentId: createTargetType === 'STUDENT' ? createStudentId : undefined,
        studentName: createTargetType === 'STUDENT' ? targetStudentName : undefined,
        title: createTitle.trim(),
        tutorId: currentUid,
        tutorName: currentName,
        startDate: createStartDate,
        startTime: createStartTime,
        endTime: createEndTime,
        recurring: createRecurring,
        weeks: createWeeks
      };

      const res = await fetch('/.netlify/functions/class-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to create schedule.');
      }

      toast.success('New class schedule setup successfully created.');
      setIsCreateModalOpen(false);
      setCreateTitle('');
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err.message || 'Schedule creation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSchedules = schedules.filter(s => {
    if (filterTarget !== 'ALL') {
      if (s.schoolId !== filterTarget && s.studentId !== filterTarget) return false;
    }
    if (activeTab === 'rescheduled') {
      return s.status === 'RESCHEDULED';
    }
    if (activeTab === 'recurring') {
      return s.recurring !== false;
    }
    return true;
  });

  const getStatusBadge = (status: ScheduleOccurrence['status'], _schedule?: ScheduleOccurrence) => {
    switch (status) {
      case 'ONGOING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase animate-pulse">
            <Radio size={12} className="animate-spin text-emerald-400" />
            Class In Session
          </span>
        );
      case 'COMPLETED':
      case 'ATTENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-black uppercase">
            <CheckCircle2 size={12} />
            Completed
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase">
            <XCircle size={12} />
            Absent
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase">
            <RotateCcw size={12} />
            Rescheduled
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] font-black uppercase">
            <AlertCircle size={12} />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-black uppercase">
            <Clock size={12} />
            Scheduled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Scheduled Classes & Teaching Rosters
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor ongoing sessions, log attendance, reschedule classes, and manage school/student time-slots.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all shadow-md shadow-indigo-600/20"
        >
          <Plus size={15} />
          <span>Set Class Schedule</span>
        </button>
      </div>

      {/* Navigation tabs & filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Scheduled Occurrences
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recurring')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'recurring'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Recurring Schedules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rescheduled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'rescheduled'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Rescheduled Classes
          </button>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-slate-400" />
          <select
            value={filterTarget}
            onChange={e => setFilterTarget(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Schools & Students</option>
            {assignedSchools.map(sch => (
              <option key={sch.id} value={sch.id}>🏫 {sch.name || sch.schoolName}</option>
            ))}
            {assignedStudents.map(st => (
              <option key={st.id} value={st.id}>👤 {st.fullName || st.studentName || st.username}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Schedule list */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-500">
          Loading assigned class schedules...
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
          <Calendar className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No scheduled classes found</p>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'rescheduled'
              ? 'No classes have been marked as rescheduled.'
              : 'Create a new recurring schedule or contact your administrator.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSchedules.map(item => (
            <div
              key={item.id}
              className={`p-4 rounded-3xl border transition-all flex flex-col justify-between space-y-4 ${
                item.status === 'ONGOING'
                  ? 'border-emerald-500/60 bg-emerald-500/5 shadow-md shadow-emerald-500/10'
                  : item.status === 'RESCHEDULED'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : item.status === 'ABSENT'
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {item.targetType === 'STUDENT' ? (
                      <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                        <User size={13} /> Private Scholar
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400">
                        <School size={13} /> {item.schoolName || 'School'}
                      </span>
                    )}
                  </div>
                  {getStatusBadge(item.status, item)}
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                  {item.title}
                </h4>

                <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400 shrink-0" />
                    <span>{item.date}</span>
                    {item.occurrenceNumber && item.occurrenceTotal && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        (Session {item.occurrenceNumber}/{item.occurrenceTotal})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-slate-400 shrink-0" />
                    <span>{item.startTime} - {item.endTime}</span>
                  </div>
                  {item.classLevel && (
                    <div className="text-[11px] text-slate-500 font-medium">
                      Class: <span className="font-bold text-slate-800 dark:text-slate-200">{item.classLevel}</span>
                    </div>
                  )}
                  {item.studentName && (
                    <div className="text-[11px] text-slate-500 font-medium">
                      Student: <span className="font-bold text-slate-800 dark:text-slate-200">{item.studentName}</span>
                    </div>
                  )}
                </div>

                {/* Reschedule Reason Box */}
                {item.status === 'RESCHEDULED' && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <RotateCcw size={12} /> Rescheduled Reason:
                    </p>
                    <p className="text-[11px]">{item.rescheduleReason || 'Rescheduled'}</p>
                    {item.rescheduledDate && (
                      <p className="text-[10px] font-mono font-bold pt-1">
                        New Time: {item.rescheduledDate} @ {item.rescheduledStartTime} - {item.rescheduledEndTime}
                      </p>
                    )}
                  </div>
                )}

                {/* Absent Reason Box */}
                {item.status === 'ABSENT' && (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                    <p className="font-bold flex items-center gap-1">
                      <XCircle size={12} /> Absence Reason:
                    </p>
                    <p className="text-[11px] mt-0.5">{item.absenceReason || 'Marked Absent'}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons for Tutor */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSchedule(item);
                    setActionType('ONGOING');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold transition-colors"
                >
                  Start / Ongoing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSchedule(item);
                    setActionType('COMPLETED');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-400 text-[11px] font-bold transition-colors"
                >
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSchedule(item);
                    setActionType('RESCHEDULED');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[11px] font-bold transition-colors"
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSchedule(item);
                    setActionType('ABSENT');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-[11px] font-bold transition-colors"
                >
                  Absent
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Reason / Reschedule Modal */}
      {selectedSchedule && actionType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
              {actionType === 'RESCHEDULED' ? 'Reschedule Class Session' : `Mark Class as ${actionType}`}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {selectedSchedule.title} • {selectedSchedule.date} ({selectedSchedule.startTime})
            </p>

            <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
              {(actionType === 'ABSENT' || actionType === 'CANCELLED' || actionType === 'RESCHEDULED') && (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Reason for {actionType.toLowerCase()} *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={statusReason}
                    onChange={e => setStatusReason(e.target.value)}
                    placeholder={`Provide a short reason for marking this class as ${actionType.toLowerCase()}...`}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                  />
                </div>
              )}

              {actionType === 'RESCHEDULED' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">New Date</label>
                    <input
                      type="date"
                      required
                      value={rescheduleDate}
                      onChange={e => setRescheduleDate(e.target.value)}
                      className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Start Time</label>
                      <input
                        type="time"
                        required
                        value={rescheduleStartTime}
                        onChange={e => setRescheduleStartTime(e.target.value)}
                        className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">End Time</label>
                      <input
                        type="time"
                        required
                        value={rescheduleEndTime}
                        onChange={e => setRescheduleEndTime(e.target.value)}
                        className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSchedule(null);
                    setActionType(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Schedule Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
              Create New Class Schedule
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Setup recurring or single teaching sessions for your assigned school or private scholar.
            </p>

            <form onSubmit={handleCreateSchedule} className="space-y-4 text-xs">
              {/* Target Type Selector */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Class Target</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateTargetType('SCHOOL')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border transition-colors ${
                      createTargetType === 'SCHOOL'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    🏫 Partner School
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateTargetType('STUDENT')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border transition-colors ${
                      createTargetType === 'STUDENT'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    👤 Private Student
                  </button>
                </div>
              </div>

              {createTargetType === 'SCHOOL' ? (
                <>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Select School</label>
                    <select
                      required
                      value={createSchoolId}
                      onChange={e => setCreateSchoolId(e.target.value)}
                      className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                    >
                      <option value="">-- Choose Assigned School --</option>
                      {assignedSchools.map(sch => (
                        <option key={sch.id} value={sch.id}>{sch.name || sch.schoolName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Class Level</label>
                    <select
                      value={createClassLevel}
                      onChange={e => setCreateClassLevel(e.target.value)}
                      className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                    >
                      {['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'JSS 1', 'JSS 2', 'JSS 3', 'SS1', 'SS2', 'SS3'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Select Private Student</label>
                  <select
                    required
                    value={createStudentId}
                    onChange={e => setCreateStudentId(e.target.value)}
                    className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                  >
                    <option value="">-- Choose Assigned Scholar --</option>
                    {assignedStudents.map(st => (
                      <option key={st.id} value={st.id}>{st.fullName || st.studentName || st.username}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Subject / Session Title</label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  placeholder="e.g. Python Programming & Game Development"
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={createStartDate}
                  onChange={e => setCreateStartDate(e.target.value)}
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={createStartTime}
                    onChange={e => setCreateStartTime(e.target.value)}
                    className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={createEndTime}
                    onChange={e => setCreateEndTime(e.target.value)}
                    className="w-full min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="chk-recurring"
                  checked={createRecurring}
                  onChange={e => setCreateRecurring(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="chk-recurring" className="text-slate-700 dark:text-slate-300 font-bold">
                  Repeat weekly ({createWeeks} weeks total)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-colors"
                >
                  {isSubmitting ? 'Creating Schedule...' : 'Save & Publish Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
