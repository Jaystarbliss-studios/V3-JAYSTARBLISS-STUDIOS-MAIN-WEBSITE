import React, { useMemo, useState } from 'react';
import {
  Users, BookOpen, Activity, ArrowUpRight, Award, BarChart3, RefreshCw,
  Database
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

interface AdminAnalyticsWidgetProps {
  studentsData?: any[];
  usersData?: any[];
  activityLogsData?: any[];
  resourcesData?: any[];
  examsData?: any[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

type TimeRange = '7d' | '30d' | '90d' | '1y';
type Tab = 'growth' | 'logins' | 'resources' | 'cbt';

const palette = ['#B91C1C', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'];

const toDate = (value: any): Date | null => {
  if (!value) return null;
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const rangeDays: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

const AdminAnalyticsWidget: React.FC<AdminAnalyticsWidgetProps> = ({
  studentsData = [],
  usersData = [],
  activityLogsData = [],
  resourcesData = [],
  examsData = [],
  onRefresh,
  isLoading = false
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [activeTab, setActiveTab] = useState<Tab>('growth');

  const now = useMemo(() => new Date(), []);

  const growthData = useMemo(() => {
    const valid = studentsData
      .map(item => ({ ...item, _date: toDate(item.createdAt || item.registeredAt) }))
      .filter(item => item._date);

    if (!valid.length) return [];

    const days = rangeDays[timeRange];
    const start = new Date(now);
    start.setDate(start.getDate() - days + 1);

    const bucketCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 5 : timeRange === '90d' ? 4 : 12;
    const bucketSize = days / bucketCount;
    const result = [];

    for (let index = 0; index < bucketCount; index += 1) {
      const bucketStart = new Date(start);
      bucketStart.setDate(start.getDate() + Math.floor(index * bucketSize));
      const bucketEnd = new Date(start);
      bucketEnd.setDate(start.getDate() + Math.floor((index + 1) * bucketSize));
      bucketEnd.setMilliseconds(bucketEnd.getMilliseconds() - 1);

      const inBucket = valid.filter(item => item._date >= bucketStart && item._date <= bucketEnd);
      const cumulative = valid.filter(item => item._date <= bucketEnd).length;
      const schoolCohort = valid.filter(item =>
        item._date <= bucketEnd && Boolean(item.schoolId || item.schoolCode)
      ).length;

      result.push({
        name: timeRange === '7d'
          ? bucketStart.toLocaleDateString(undefined, { weekday: 'short' })
          : timeRange === '1y'
            ? bucketStart.toLocaleDateString(undefined, { month: 'short' })
            : `Period ${index + 1}`,
        total: cumulative,
        schoolCohort,
        individual: Math.max(0, cumulative - schoolCohort),
        newSignups: inBucket.length
      });
    }
    return result;
  }, [studentsData, timeRange, now]);

  const loginData = useMemo(() => {
    const valid = activityLogsData
      .filter(log => log.type === 'login' || String(log.type || '').toLowerCase().includes('login'))
      .map(log => ({ ...log, _date: toDate(log.timestamp || log.createdAt) }))
      .filter(log => log._date);

    if (!valid.length) return [];

    const days = rangeDays[timeRange];
    const start = new Date(now);
    start.setDate(start.getDate() - days + 1);
    const bucketCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 5 : timeRange === '90d' ? 4 : 12;
    const bucketSize = days / bucketCount;
    const result = [];

    for (let index = 0; index < bucketCount; index += 1) {
      const bucketStart = new Date(start);
      bucketStart.setDate(start.getDate() + Math.floor(index * bucketSize));
      const bucketEnd = new Date(start);
      bucketEnd.setDate(start.getDate() + Math.floor((index + 1) * bucketSize));
      bucketEnd.setMilliseconds(bucketEnd.getMilliseconds() - 1);

      const bucketLogs = valid.filter(log => log._date >= bucketStart && log._date <= bucketEnd);
      const counts = { student: 0, staff: 0, parent: 0, school: 0 };
      bucketLogs.forEach(log => {
        const role = String(log.userType || log.role || 'student').toLowerCase();
        if (role.includes('staff') || role.includes('tutor') || role.includes('instructor')) counts.staff += 1;
        else if (role.includes('parent')) counts.parent += 1;
        else if (role.includes('school')) counts.school += 1;
        else counts.student += 1;
      });

      result.push({
        name: timeRange === '7d'
          ? bucketStart.toLocaleDateString(undefined, { weekday: 'short' })
          : timeRange === '1y'
            ? bucketStart.toLocaleDateString(undefined, { month: 'short' })
            : `Period ${index + 1}`,
        ...counts,
        total: counts.student + counts.staff + counts.parent + counts.school
      });
    }
    return result;
  }, [activityLogsData, timeRange, now]);

  const resourceData = useMemo(() => {
    const groups = new Map<string, { category: string; resources: number; views: number; downloads: number }>();
    resourcesData.forEach(item => {
      const category = String(item.category || item.subject || item.type || 'General Resources');
      const existing = groups.get(category) || { category, resources: 0, views: 0, downloads: 0 };
      existing.resources += 1;
      existing.views += Number(item.views || item.viewCount || 0);
      existing.downloads += Number(item.downloads || item.downloadCount || 0);
      groups.set(category, existing);
    });
    return Array.from(groups.values()).sort((a, b) => b.resources - a.resources).slice(0, 8);
  }, [resourcesData]);

  const cbtData = useMemo(() => examsData
    .map(exam => ({
      grade: String(exam.targetClass || exam.class || exam.title || 'Assessment').slice(0, 24),
      registered: Number(exam.registered || exam.registeredCount || 0),
      taken: Number(exam.taken || exam.attempts || exam.completedCount || 0),
      passed: Number(exam.passed || exam.passedCount || 0),
      avgScore: Number(exam.avgScore || exam.averageScore || 0)
    }))
    .filter(row => row.registered || row.taken || row.passed || row.avgScore)
    .slice(0, 10), [examsData]);

  const trackedViews = resourcesData.reduce((sum, item) => sum + Number(item.views || item.viewCount || 0), 0);
  const trackedDownloads = resourcesData.reduce((sum, item) => sum + Number(item.downloads || item.downloadCount || 0), 0);
  const trackedLogins = activityLogsData.filter(log => String(log.type || '').toLowerCase().includes('login')).length;
  const trackedCbt = cbtData.length;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'growth', label: 'Student Growth Trend', icon: Users },
    { key: 'logins', label: 'Portal Login Frequency', icon: Activity },
    { key: 'resources', label: 'Resource Engagement', icon: BookOpen },
    { key: 'cbt', label: 'CBT Assessment Performance', icon: Award }
  ];

  return (
    <div className="pro-surface rounded-3xl overflow-hidden transition-colors">
      <div className="p-6 md:p-8 border-b border-gray-100 dark:border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-brand-red/10 text-brand-red"><BarChart3 size={20} /></span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Super Admin Telemetry &amp; Analytics Matrix</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">Analytics generated only from records actually present in Firestore.</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl border border-gray-200/50 dark:border-white/5">
            {(['7d', '30d', '90d', '1y'] as TimeRange[]).map(range => (
              <button key={range} type="button" onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeRange === range ? 'bg-white dark:bg-brand-red text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
              </button>
            ))}
          </div>
          {onRefresh && <button type="button" onClick={onRefresh} disabled={isLoading} className="p-2 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors disabled:opacity-50" title="Refresh Firestore Metrics"><RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /></button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 md:px-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20">
        {[
          ['Student records', studentsData.length, 'Current Firestore records'],
          ['Active accounts', usersData.length, 'Current user records'],
          ['Published resources', resourcesData.length, trackedViews ? `${trackedViews} tracked views` : 'Views not yet tracked'],
          ['Assessments', examsData.length, trackedCbt ? `${trackedCbt} with performance data` : 'Performance data not yet tracked']
        ].map(([label, value, note], index) => (
          <div key={String(label)} className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-gray-100 dark:border-white/5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mb-2">
              <span className="font-semibold">{label}</span>
              {index === 0 && <ArrowUpRight size={14} className="text-emerald-500" />}
              {index === 1 && <Users size={14} className="text-blue-500" />}
              {index === 2 && <BookOpen size={14} className="text-blue-500" />}
              {index === 3 && <Award size={14} className="text-emerald-500" />}
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{value}</div>
            <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">{note}</div>
          </div>
        ))}
      </div>

      <div className="px-6 md:px-8 pt-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.key ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
            <Icon size={16} /><span>{tab.label}</span>
          </button>;
        })}
      </div>

      <div className="p-6 md:p-8">
        {activeTab === 'growth' && (
          <div className="space-y-6">
            {growthData.length ? <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <RechartsTooltip />
                <Area type="monotone" dataKey="total" name="Cumulative Students" stroke={palette[0]} fill={palette[0]} fillOpacity={0.12} strokeWidth={3} />
                <Area type="monotone" dataKey="schoolCohort" name="School-linked Students" stroke={palette[1]} fill={palette[1]} fillOpacity={0.08} strokeWidth={2} />
                <Line type="monotone" dataKey="newSignups" name="New Records" stroke={palette[2]} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer> : <EmptyTelemetry message="Student records do not contain usable creation dates yet." />}
          </div>
        )}

        {activeTab === 'logins' && (
          <div className="space-y-4">
            {loginData.length ? <ResponsiveContainer width="100%" height={340}>
              <BarChart data={loginData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="student" stackId="a" name="Students" fill={palette[0]} />
                <Bar dataKey="staff" stackId="a" name="Staff/Tutors" fill={palette[1]} />
                <Bar dataKey="parent" stackId="a" name="Parents" fill={palette[2]} />
                <Bar dataKey="school" stackId="a" name="Schools" fill={palette[3]} />
              </BarChart>
            </ResponsiveContainer> : <EmptyTelemetry message="No login activity records have been captured yet." />}
            <p className="text-xs text-gray-500 flex items-center gap-2"><Database size={13} /> {trackedLogins} login events currently tracked.</p>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="space-y-4">
            {resourceData.length ? <ResponsiveContainer width="100%" height={340}>
              <BarChart data={resourceData} margin={{ left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="resources" name="Published resources" fill={palette[1]} />
                <Bar dataKey="views" name="Tracked views" fill={palette[2]} />
                <Bar dataKey="downloads" name="Tracked downloads" fill={palette[3]} />
              </BarChart>
            </ResponsiveContainer> : <EmptyTelemetry message="No resources have been published yet." />}
            <p className="text-xs text-gray-500 flex items-center gap-2"><Database size={13} /> {trackedViews} views and {trackedDownloads} downloads are currently tracked.</p>
          </div>
        )}

        {activeTab === 'cbt' && (
          <div className="space-y-4">
            {cbtData.length ? <ResponsiveContainer width="100%" height={340}>
              <BarChart data={cbtData} margin={{ left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis dataKey="grade" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="registered" name="Registered" fill={palette[1]} />
                <Bar dataKey="taken" name="Taken" fill={palette[2]} />
                <Bar dataKey="passed" name="Passed" fill={palette[0]} />
              </BarChart>
            </ResponsiveContainer> : <EmptyTelemetry message="No CBT performance telemetry is stored yet. The dashboard will populate automatically once assessments record attempts/results." />}
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyTelemetry: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-[340px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-center px-6">
    <Database size={28} className="text-gray-300 mb-3" />
    <p className="text-sm font-bold text-gray-700 dark:text-slate-300">{message}</p>
  </div>
);

export default AdminAnalyticsWidget;
