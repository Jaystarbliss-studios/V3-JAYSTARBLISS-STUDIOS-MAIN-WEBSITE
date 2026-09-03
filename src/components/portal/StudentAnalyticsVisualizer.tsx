import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Award, 
  BarChart3, 
  PieChart as PieChartIcon, 
  LineChart as LineChartIcon,
  Layers,
  ArrowUpRight,
  Sparkles,
  BookOpen,
  Filter,
  CheckSquare
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

interface LearningProgressItem { subject: string; progress: number; modulesDone: number; modulesTotal: number; hours: number; }
interface CompetencyItem { skill: string; score: number; classAvg: number; }
interface AssignmentWeeklyItem { week: string; completed: number; submittedLate: number; pending: number; }
interface AssignmentStatusItem { name: string; value: number; color: string; }
interface GradeTrendItem { id: string; date: string; assessment: string; subject: string; classAvg: number; grade: number; tier: string; }

export interface StudentAnalyticsProps {
  studentName?: string;
  studentClass?: string;
  enrolledSubjects?: string[];
  completedModulesCount?: number;
  totalModulesCount?: number;
  className?: string;
}

export const StudentAnalyticsVisualizer: React.FC<StudentAnalyticsProps> = ({
  studentName = 'Student',
  studentClass = 'Not recorded',
  enrolledSubjects = [],
  completedModulesCount = 0,
  totalModulesCount = 0,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'assignments' | 'grades'>('overview');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'30days' | 'term' | 'all'>('term');

  // Dynamic list of subjects for filter
  const filterSubjectList = useMemo(() => {
    const combined = Array.from(new Set(enrolledSubjects || []));
    return ['ALL', ...combined];
  }, [enrolledSubjects]);

  // 1. Learning Progress Data across Course Tracks
  const learningProgressData = useMemo<LearningProgressItem[]>(() => [], []);

  // 2. Skill Competency Radar Data
  const competencyRadarData = useMemo<CompetencyItem[]>(() => [], []);

  // 3. Assignment Completion Rate Timeline (Weekly Velocity)
  const assignmentWeeklyData = useMemo<AssignmentWeeklyItem[]>(() => [], []);

  // 4. Assignment Completion Breakdown (Status Donut)
  const assignmentStatusPie = useMemo<AssignmentStatusItem[]>(() => [], []);

  // 5. Recent Grade Trends over time (Quizzes, Exams & Capstones)
  const gradeTrendsData = useMemo<GradeTrendItem[]>(() => [], []);

  // Filtered Grade Trends based on subject selector
  const filteredGradeTrends = useMemo(() => {
    if (selectedSubject === 'ALL') return gradeTrendsData;
    return gradeTrendsData.filter(item => item.subject.toLowerCase() === selectedSubject.toLowerCase());
  }, [gradeTrendsData, selectedSubject]);

  // Overall Computed Stats
  const stats = useMemo(() => {
    const totalAssignments = assignmentStatusPie.reduce((acc, curr) => acc + curr.value, 0);
    const completedAssignments = assignmentStatusPie.find(p => p.name.includes('On-Time'))?.value || 0;
    const completedLate = assignmentStatusPie.find(p => p.name.includes('Late'))?.value || 0;
    const completionRate = totalAssignments ? Math.round(((completedAssignments + completedLate) / totalAssignments) * 100) : 0;

    const avgGrade = gradeTrendsData.length ? Math.round(
      gradeTrendsData.reduce((acc, curr) => acc + curr.grade, 0) / gradeTrendsData.length
    ) : 0;

    const latestGrade = gradeTrendsData[gradeTrendsData.length - 1]?.grade || 0;
    const previousGrade = gradeTrendsData[gradeTrendsData.length - 2]?.grade || 0;
    const gradeDelta = latestGrade - previousGrade;

    const totalLearningHours = learningProgressData.reduce((acc, curr) => acc + curr.hours, 0);
    const overallSyllabusProgress = learningProgressData.length ? Math.round(
      learningProgressData.reduce((acc, curr) => acc + curr.progress, 0) / learningProgressData.length
    ) : 0;

    return {
      completionRate,
      totalAssignments,
      completedAssignments: completedAssignments + completedLate,
      avgGrade,
      latestGrade,
      gradeDelta,
      totalLearningHours,
      overallSyllabusProgress,
      hasGradeData: gradeTrendsData.length > 0,
      hasAssignmentData: assignmentStatusPie.length > 0,
      hasLearningData: learningProgressData.length > 0
    };
  }, [assignmentStatusPie, gradeTrendsData, learningProgressData]);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950/95 dark:bg-[#0b101b]/95 border border-slate-700/60 dark:border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs z-50">
          <p className="font-bold text-white mb-1.5">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: entry.color || entry.fill || entry.stroke }} />
                <span className="capitalize">{entry.name}:</span>
              </span>
              <span className="font-bold text-white font-mono">{entry.value}{entry.unit || (entry.dataKey?.toLowerCase().includes('rate') || entry.dataKey?.toLowerCase().includes('grade') || entry.dataKey?.toLowerCase().includes('progress') || entry.dataKey?.toLowerCase().includes('score') ? '%' : '')}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white dark:bg-[#121622] rounded-2xl border border-gray-200/80 dark:border-white/5 p-6 md:p-8 shadow-sm ${className}`}>
      
      {/* Header & Section Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200/60 dark:border-red-500/20">
            <BarChart3 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Academic Analytics & Progress Visualizer
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 text-[11px] font-bold border border-red-200/60 dark:border-red-500/20">
                <Sparkles size={11} /> Real-Time Recharts
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Comprehensive telemetry for {studentName} • {studentClass}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center flex-wrap gap-1 p-1 bg-gray-100 dark:bg-slate-900/80 rounded-xl border border-gray-200/60 dark:border-white/5 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Layers size={14} /> Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('progress')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'progress'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BookOpen size={14} /> Learning Progress
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'assignments'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CheckSquare size={14} /> Completion Rates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grades')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'grades'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <LineChartIcon size={14} /> Grade Trends
          </button>
        </div>
      </div>

      {/* Top Level Metric Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        {/* Metric 1: Overall Grade Average */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Average Grade</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Award size={15} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {stats.hasGradeData ? `${stats.avgGrade}%` : '—'}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={12} /> {stats.hasGradeData ? `${stats.gradeDelta >= 0 ? '+' : ''}${stats.gradeDelta}%` : 'No change yet'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">{stats.hasGradeData ? (stats.avgGrade >= 70 ? 'Current performance band' : 'Performance data recorded') : 'No assessments recorded yet'}</p>
        </div>

        {/* Metric 2: Assignment Completion Rate */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Assignment Rate</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {stats.hasAssignmentData ? `${stats.completionRate}%` : '—'}
            </span>
            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
              {stats.hasAssignmentData ? `${stats.completedAssignments}/${stats.totalAssignments} Tasks` : 'No tasks recorded'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">{stats.hasAssignmentData ? `${Math.max(stats.totalAssignments - stats.completedAssignments, 0)} Pending Tasks` : 'No assignment data yet'}</p>
        </div>

        {/* Metric 3: Syllabus Progression */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Syllabus Progress</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <BookOpen size={15} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {stats.overallSyllabusProgress}%
            </span>
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">
              {stats.hasLearningData ? 'Tracking' : 'Awaiting data'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">{completedModulesCount} of {totalModulesCount} Modules Mastered</p>
        </div>

        {/* Metric 4: Total Lab & Coding Hours */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Learning Time</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock size={15} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {stats.totalLearningHours} <span className="text-sm font-semibold">hrs</span>
            </span>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              Recorded learning time
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">{stats.hasLearningData && learningProgressData.length ? `${(stats.totalLearningHours / learningProgressData.length).toFixed(1)} hrs / track average` : 'No learning-time data yet'}</p>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW COMPOSITE VIEW (Combined Highlights)                      */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Recent Grade Trajectory Area Chart (7 Cols) */}
            <div className="lg:col-span-7 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-white/5 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <LineChartIcon size={18} className="text-red-500" /> Recent Grade Trajectory
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Chronological score trend with class average benchmarks</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('grades')}
                  className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5"
                >
                  View Details <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="h-64 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gradeTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e63946" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#e63946" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }} tickLine={false} />
                    <YAxis domain={[60, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="grade" 
                      name="Cadet Grade" 
                      stroke="#e63946" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#gradeGradient)" 
                      activeDot={{ r: 6, fill: '#e63946', stroke: '#fff', strokeWidth: 2 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="classAvg" 
                      name="Class Average" 
                      stroke="#94a3b8" 
                      strokeDasharray="4 4" 
                      strokeWidth={2} 
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-center gap-6 pt-3 text-xs text-gray-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-1 bg-red-600 rounded-full inline-block" /> Student Grade Score
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-0.5 bg-slate-400 rounded-full inline-block border-b border-dashed border-slate-400" /> Class Benchmark Average
                </span>
              </div>
            </div>

            {/* Assignment Status Breakdown Donut (5 Cols) */}
            <div className="lg:col-span-5 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-white/5 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon size={18} className="text-emerald-500" /> Assignment Status Distribution
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{stats.totalAssignments} Total registered deliverables</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('assignments')}
                  className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5"
                >
                  Breakdown <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="h-52 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assignmentStatusPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {assignmentStatusPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Stat in Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-gray-900 dark:text-white leading-none">
                    {stats.completionRate}%
                  </span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                    Completed
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                {assignmentStatusPie.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-white/60 dark:bg-slate-950/40 border border-gray-100 dark:border-white/5">
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-slate-300 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white font-mono text-[11px]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom Subject Progress Bars Grid */}
          <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BookOpen size={18} className="text-sky-500" /> Syllabus Progression by Course Track
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Milestone completion across active enrolled subjects</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('progress')}
                className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5"
              >
                Track Radar <ArrowUpRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {learningProgressData.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-white dark:bg-[#121622] rounded-xl border border-gray-100 dark:border-white/5 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{item.subject}</span>
                    <span className="text-xs font-black text-red-600 dark:text-red-400">{item.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-gradient-to-r from-red-600 to-amber-500 rounded-full transition-all duration-1000"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400">
                    <span>{item.modulesDone}/{item.modulesTotal} Modules</span>
                    <span>{item.hours}h invested</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LEARNING PROGRESS & COMPETENCIES (Bar & Radar Visuals)              */}
      {/* ========================================================================= */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Learning Hours & Module Progress Bar Chart (7 Cols) */}
            <div className="lg:col-span-7 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-white/5 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Subject Mastery & Hours Invested</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Comparative progress score vs hands-on lab hours</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                  {enrolledSubjects.length} Active Disciplines
                </span>
              </div>

              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={learningProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                    <XAxis 
                      dataKey="subject" 
                      tick={{ fill: '#94a3b8', fontSize: 10 }} 
                      axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="progress" name="Syllabus Progress %" fill="#e63946" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="hours" name="Lab Hours" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar Skill Competency Matrix (5 Cols) */}
            <div className="lg:col-span-5 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-white/5 p-5 flex flex-col justify-between">
              <div className="mb-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Competency Radar Matrix</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Core engineering skills compared to class baseline</p>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={competencyRadarData}>
                    <PolarGrid stroke="rgba(148, 163, 184, 0.2)" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Radar name="Cadet Rating" dataKey="score" stroke="#e63946" fill="#e63946" fillOpacity={0.45} />
                    <Radar name="Class Benchmark" dataKey="classAvg" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[11px] text-center text-gray-500 dark:text-slate-400 mt-2">
                Strongest domain: <strong className="text-gray-900 dark:text-white">{competencyRadarData.length ? competencyRadarData.reduce((best, item) => item.score > best.score ? item : best, competencyRadarData[0]).skill : 'Not enough competency data'}</strong>
              </p>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ASSIGNMENT COMPLETION RATES (Timeline & Velocity)                  */}
      {/* ========================================================================= */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Weekly Submission Velocity Bar Chart (8 Cols) */}
            <div className="lg:col-span-8 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-white/5 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Weekly Assignment Submission Velocity</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Total tasks completed vs pending deliverables per week</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
                    {stats.hasAssignmentData ? `${stats.completionRate}% Completion Rate` : 'No assignment history'}
                  </span>
                </div>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assignmentWeeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="completed" name="Completed On-Time" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="submittedLate" name="Late Submission" fill="#f59e0b" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill="#e63946" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Completion Rate Gauge & Breakdown (4 Cols) */}
            <div className="lg:col-span-4 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-white/5 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Completion Health</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Quality and punctuality scoring</p>
              </div>

              <div className="my-4 p-4 rounded-xl bg-white dark:bg-[#121622] border border-gray-100 dark:border-white/5 text-center">
                <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {stats.completionRate}%
                </span>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-1">Excellent Punctuality Band</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">{stats.hasAssignmentData ? `${stats.completedAssignments} of ${stats.totalAssignments} Total Assignments Recorded` : 'No assignment records available'}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/60 dark:bg-slate-950/40 border border-gray-100 dark:border-white/5">
                  <span className="text-gray-600 dark:text-slate-300">On-Time Submissions</span>
                  <span className="font-bold text-emerald-600 font-mono">{stats.hasAssignmentData ? `${Math.round((assignmentStatusPie.find(p => p.name.includes('On-Time'))?.value || 0) / Math.max(stats.totalAssignments, 1) * 100)}%` : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/60 dark:bg-slate-950/40 border border-gray-100 dark:border-white/5">
                  <span className="text-gray-600 dark:text-slate-300">Tutor Re-submissions</span>
                  <span className="font-bold text-amber-600 font-mono">{stats.hasAssignmentData ? `${Math.round((assignmentStatusPie.find(p => p.name.includes('Late'))?.value || 0) / Math.max(stats.totalAssignments, 1) * 100)}%` : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/60 dark:bg-slate-950/40 border border-gray-100 dark:border-white/5">
                  <span className="text-gray-600 dark:text-slate-300">Unsubmitted Overdue</span>
                  <span className="font-bold text-red-600 font-mono">{stats.hasAssignmentData ? `${Math.round(Math.max(stats.totalAssignments - stats.completedAssignments, 0) / Math.max(stats.totalAssignments, 1) * 100)}%` : '—'}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RECENT GRADE TRENDS (Detailed Multi-line & Filters)                */}
      {/* ========================================================================= */}
      {activeTab === 'grades' && (
        <div className="space-y-6">
          
          <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-gray-100 dark:border-white/5 p-5">
            
            {/* Subject Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-200/60 dark:border-white/5">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <LineChartIcon size={18} className="text-red-500" /> Assessment Score Progression
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Filter by academic track to analyze subject-specific performance</p>
              </div>

              {/* Subject Dropdown / Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1 mr-1">
                  <Filter size={12} /> Subject:
                </span>
                {filterSubjectList.map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSelectedSubject(subj)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedSubject === subj
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/60 dark:border-white/5'
                    }`}
                  >
                    {subj === 'ALL' ? 'All Subjects' : subj}
                  </button>
                ))}

                <span className="text-gray-300 dark:text-white/10 mx-1">|</span>

                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800/80 p-0.5 rounded-lg">
                  {(['30days', 'term', 'all'] as const).map((rng) => (
                    <button
                      key={rng}
                      type="button"
                      onClick={() => setTimeRange(rng)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold capitalize transition-all ${
                        timeRange === rng
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {rng === '30days' ? 'Last 30D' : rng === 'term' ? 'Current Term' : 'All Time'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grade Trajectory LineChart with Points and Tier Badges */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredGradeTrends} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }} tickLine={false} />
                  <YAxis domain={[65, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  
                  <Line 
                    type="monotone" 
                    dataKey="grade" 
                    name="Student Score %" 
                    stroke="#e63946" 
                    strokeWidth={3} 
                    dot={{ r: 5, fill: '#e63946', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#e63946', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="classAvg" 
                    name="Cohort Average" 
                    stroke="#94a3b8" 
                    strokeDasharray="4 4" 
                    strokeWidth={2} 
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Assessment History Table */}
            <div className="mt-6 pt-4 border-t border-gray-200/60 dark:border-white/5">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                Recorded Assessment Logs ({filteredGradeTrends.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/5 text-gray-500 dark:text-slate-400">
                      <th className="pb-2 font-bold">Date</th>
                      <th className="pb-2 font-bold">Assessment Title</th>
                      <th className="pb-2 font-bold">Subject</th>
                      <th className="pb-2 font-bold text-center">Cohort Avg</th>
                      <th className="pb-2 font-bold text-right">Score & Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredGradeTrends.map((row) => (
                      <tr key={row.id} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 font-mono text-gray-500">{row.date}</td>
                        <td className="py-2.5 font-bold text-gray-900 dark:text-white">{row.assessment}</td>
                        <td className="py-2.5 text-gray-600 dark:text-slate-400">{row.subject}</td>
                        <td className="py-2.5 text-center font-mono text-gray-500">{row.classAvg}%</td>
                        <td className="py-2.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-bold text-red-600 dark:text-red-400 font-mono text-sm">{row.grade}%</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                              {row.tier}
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default StudentAnalyticsVisualizer;
