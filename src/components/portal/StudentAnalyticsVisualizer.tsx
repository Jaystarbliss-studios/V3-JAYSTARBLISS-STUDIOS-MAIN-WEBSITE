import React, { useMemo, useState } from 'react';
import { TrendingUp, CheckCircle2, Clock, Award, BarChart3, Layers, BookOpen, Database } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';

interface AnalyticsModule {
  id: string;
  title: string;
  trackName?: string;
  stageName?: string;
  completed?: boolean;
  completionDate?: string;
  score?: string | number;
  hours?: number;
  learningHours?: number;
}

interface AnalyticsExam {
  id: string;
  title: string;
  subject?: string;
  date?: string;
  dueDate?: string;
  score?: number | string;
  grade?: number | string;
  classAvg?: number | string;
  averageScore?: number | string;
}

export interface StudentAnalyticsProps {
  studentName?: string;
  studentClass?: string;
  enrolledSubjects?: string[];
  completedModulesCount?: number;
  totalModulesCount?: number;
  modules?: AnalyticsModule[];
  exams?: AnalyticsExam[];
  className?: string;
}

const palette = ['#B91C1C', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

const parseScore = (value: unknown) => {
  const score = Number(String(value ?? '').replace('%', ''));
  return Number.isFinite(score) && score >= 0 ? score : null;
};

const formatDate = (value: unknown) => {
  if (!value) return 'Date not recorded';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-[300px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-center px-6">
    <Database size={28} className="text-gray-300 mb-3" />
    <p className="text-sm font-bold text-gray-700 dark:text-slate-300">{message}</p>
  </div>
);

export const StudentAnalyticsVisualizer: React.FC<StudentAnalyticsProps> = ({
  studentName = 'Active Student',
  studentClass = 'Class not recorded',
  enrolledSubjects = [],
  completedModulesCount = 0,
  totalModulesCount = 0,
  modules = [],
  exams = [],
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'completion' | 'grades'>('overview');

  const progressData = useMemo(() => {
    const groups = new Map<string, { subject: string; completed: number; total: number; hours: number }>();
    modules.forEach(module => {
      const subject = module.trackName || module.stageName || enrolledSubjects[0] || 'Current Program';
      const row = groups.get(subject) || { subject, completed: 0, total: 0, hours: 0 };
      row.total += 1;
      if (module.completed) row.completed += 1;
      row.hours += Number(module.hours || module.learningHours || 0);
      groups.set(subject, row);
    });
    return Array.from(groups.values()).map(row => ({
      ...row,
      progress: row.total ? Math.round((row.completed / row.total) * 100) : 0
    }));
  }, [modules, enrolledSubjects]);

  const gradeData = useMemo(() => exams
    .map(exam => ({
      id: exam.id,
      name: exam.title,
      subject: exam.subject || 'Assessment',
      date: formatDate(exam.date || exam.dueDate),
      grade: parseScore(exam.score ?? exam.grade ?? exam.averageScore),
      classAvg: parseScore(exam.classAvg)
    }))
    .filter(exam => exam.grade !== null)
    .slice(-12), [exams]);

  const totalModules = modules.length || totalModulesCount;
  const completedModules = modules.length ? modules.filter(module => module.completed).length : completedModulesCount;
  const completionRate = totalModules ? Math.round((completedModules / totalModules) * 100) : null;
  const averageGrade = gradeData.length
    ? Math.round(gradeData.reduce((sum, item) => sum + (item.grade || 0), 0) / gradeData.length)
    : null;
  const learningHours = progressData.reduce((sum, item) => sum + item.hours, 0);

  const metrics: Array<{ label: string; value: string; note: string; icon: React.ElementType }> = [
    { label: 'Average Grade', value: averageGrade === null ? '—' : `${averageGrade}%`, note: 'From recorded assessments', icon: Award },
    { label: 'Milestone Rate', value: completionRate === null ? '—' : `${completionRate}%`, note: `${completedModules}/${totalModules} milestones verified`, icon: CheckCircle2 },
    { label: 'Syllabus Progress', value: completionRate === null ? '—' : `${completionRate}%`, note: 'Based on recorded modules', icon: BookOpen },
    { label: 'Learning Time', value: learningHours ? `${learningHours} hrs` : '—', note: learningHours ? 'Recorded module hours' : 'Hours not yet tracked', icon: Clock }
  ];

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Layers },
    { key: 'progress', label: 'Learning Progress', icon: BookOpen },
    { key: 'completion', label: 'Milestone Completion', icon: CheckCircle2 },
    { key: 'grades', label: 'Grade Trends', icon: TrendingUp }
  ] as const;

  return (
    <div className={`bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 md:p-8 shadow-sm ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <BarChart3 size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Academic Analytics &amp; Progress Visualizer</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Live learning records for {studentName} • {studentClass}</p>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-1 p-1 bg-gray-100 dark:bg-slate-900/80 rounded-xl border border-gray-200/60 dark:border-white/5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.key ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map(metric => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">{metric.label}</span>
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center"><Icon size={15} /></div>
              </div>
              <span className="text-2xl font-black text-gray-900 dark:text-white">{metric.value}</span>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">{metric.note}</p>
            </div>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-5">
          {gradeData.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <RechartsTooltip />
                <Legend />
                <Area type="monotone" dataKey="grade" name="Student Grade" stroke={palette[0]} fill={palette[0]} fillOpacity={0.1} strokeWidth={3} />
                <Area type="monotone" dataKey="classAvg" name="Recorded Class Average" stroke={palette[1]} fill={palette[1]} fillOpacity={0.06} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No assessment scores have been recorded for this student yet." />}
        </div>
      )}

      {activeTab === 'progress' && (
        <div>
          {progressData.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={progressData} margin={{ left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis dataKey="subject" tick={{ fontSize: 10 }} angle={-12} textAnchor="end" height={55} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <RechartsTooltip />
                <Bar dataKey="progress" name="Completion %" fill={palette[1]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No program modules have been assigned to this student yet." />}
        </div>
      )}

      {activeTab === 'completion' && (
        <div className="space-y-5">
          {totalModules ? (
            <div className="max-w-xl mx-auto">
              <div className="flex items-center justify-between text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                <span>Verified milestones</span><span>{completedModules} / {totalModules}</span>
              </div>
              <div className="h-4 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${completionRate || 0}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">Only completed module records are counted. No synthetic task history is displayed.</p>
            </div>
          ) : <EmptyState message="Milestone completion will appear after modules are assigned." />}
        </div>
      )}

      {activeTab === 'grades' && (
        <div>
          {gradeData.length ? (
            <div className="space-y-3">
              {gradeData.map(item => (
                <div key={item.id} className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.subject} • {item.date}</p>
                  </div>
                  <span className="text-lg font-black text-red-600">{item.grade}%</span>
                </div>
              ))}
            </div>
          ) : <EmptyState message="No graded assessments are available yet." />}
        </div>
      )}
    </div>
  );
};

export default StudentAnalyticsVisualizer;
