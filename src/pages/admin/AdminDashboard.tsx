import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, BookOpen, Download, 
  RefreshCw, School, Award, ArrowUpRight,
  ShieldCheck, CheckCircle2,
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import AdminAnalyticsWidget from '../../components/admin/AdminAnalyticsWidget';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const ROLE_COLORS = ['#0284c7', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

const AdminDashboard: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [metrics, setMetrics] = useState({
    users: 0,
    students: 0,
    schools: 0,
    programs: 0,
    inquiries: 0,
    services: 0,
    resources: 0,
    exams: 0
  });

  const [inquiriesData, setInquiriesData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [activityLogsData, setActivityLogsData] = useState<any[]>([]);
  const [resourcesData, setResourcesData] = useState<any[]>([]);
  const [examsData, setExamsData] = useState<any[]>([]);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        usersSnap, 
        studentsSnap, 
        schoolsSnap,
        programsSnap, 
        inquiriesSnap, 
        servicesSnap,
        resourcesSnap,
        schoolResourcesSnap,
        examsSnap,
        schoolExamsSnap,
        activitySnap
      ] = await Promise.all([
        getDocs(collection(db, 'users')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'individualStudents')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'schools')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'programs')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'inquiries')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'services')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'resources')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'schoolResources')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'exams')).catch(() => ({ size: 0, docs: [] })),
        getDocs(collection(db, 'schoolExams')).catch(() => ({ size: 0, docs: [] })),
        getDocs(query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(100))).catch(() => ({ size: 0, docs: [] }))
      ]);

      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const studentsList = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const inquiriesList = inquiriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const resourcesList = [
        ...resourcesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...schoolResourcesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ];
      const examsList = [
        ...examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...schoolExamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ];
      const activityList = activitySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setMetrics({
        users: usersSnap.size,
        students: studentsSnap.size,
        schools: schoolsSnap.size,
        programs: programsSnap.size,
        inquiries: inquiriesSnap.size,
        services: servicesSnap.size,
        resources: resourcesList.length,
        exams: examsList.length
      });

      setUsersData(usersList);
      setStudentsData(studentsList);
      setInquiriesData(inquiriesList);
      setResourcesData(resourcesList);
      setExamsData(examsList);
      setActivityLogsData(activityList);

      if (isManualRefresh) {
        toast.success('Telemetry and analytics updated successfully.');
      }
    } catch (error) {
      console.error("Error fetching dashboard telemetry:", error);
      toast.error('Could not refresh some telemetry collections.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.info(`No ${filename} records to export.`);
      return;
    }
    const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${(row[header] !== undefined && row[header] !== null ? String(row[header]) : '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${data.length} records to ${filename}.csv`);
  };

  const stats = [
    { 
      name: 'Enrolled Cadets', 
      value: metrics.students, 
      icon: Users, 
      color: 'from-sky-500 to-blue-600', 
      iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
      href: '/admin/students', 
      badge: 'Active Cohorts',
      trend: '+14% this month'
    },
    { 
      name: 'Partner Schools', 
      value: metrics.schools, 
      icon: School, 
      color: 'from-blue-600 to-indigo-700', 
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
      href: '/admin/schools', 
      badge: 'Montessori Portals',
      trend: '100% operational'
    },
    { 
      name: 'Curriculum Guides', 
      value: metrics.resources, 
      icon: BookOpen, 
      color: 'from-cyan-500 to-sky-600', 
      iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
      href: '/admin/resources', 
      badge: 'PDF & Labs',
      trend: 'Updated recently'
    },
    { 
      name: 'CBT Assessments', 
      value: metrics.exams, 
      icon: Award, 
      color: 'from-emerald-500 to-teal-600', 
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      href: '/admin/schools', 
      badge: 'Testing Windows',
      trend: 'Realtime grading'
    },
  ];

  const inquiriesByType = inquiriesData.reduce((acc, curr) => {
    const type = curr.type || 'GENERAL';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const chartDataInquiries = Object.keys(inquiriesByType).map(key => ({ name: key, value: inquiriesByType[key] }));

  const usersByRole = usersData.reduce((acc, curr) => {
    const role = curr.role || 'STUDENT';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const chartDataUsers = Object.keys(usersByRole).map(key => ({ name: key, value: usersByRole[key] }));

  return (
    <div className="dashboard-interface space-y-6">
      {/* Top Banner & Control Actions */}
      <div className="pro-surface rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" /> Super Admin Center
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <CheckCircle2 size={12} className="text-emerald-500" /> Firestore Connected
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Administrative Matrix
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Realtime telemetry across student growth cohorts, school operations, portal activity, and automated assessments.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            type="button"
            onClick={() => exportToCSV(studentsData.length > 0 ? studentsData : usersData, 'students_cadets_registry')}
            className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
          >
            <Download size={14} className="text-sky-600 dark:text-sky-400" />
            <span>Export CSV</span>
          </button>
          
          <button 
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Firestore'}</span>
          </button>
        </div>
      </div>
      
      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div 
              key={item.name} 
              className="pro-surface pro-interactive overflow-hidden rounded-2xl p-5 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {item.name}
                  </span>
                  <div className="text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
                    {loading ? '...' : item.value}
                  </div>
                  <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {item.trend}
                  </span>
                </div>
                <div className={`rounded-xl p-3 ${item.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  {item.badge}
                </span>
                <Link to={item.href} className="font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors inline-flex items-center gap-1">
                  Manage <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Navigation Shortcuts Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending Approvals', href: '/admin/approvals', icon: ShieldCheck, badge: 'Schools' },
          { label: 'Student Cadets', href: '/admin/students', icon: Users, badge: 'Registry' },
          { label: 'Curriculum & CBT', href: '/admin/resources', icon: BookOpen, badge: 'Library' },
          { label: 'Public Inquiries', href: '/admin/inquiries', icon: Bell, badge: 'Admissions' },
        ].map((action, idx) => {
          const ActionIcon = action.icon;
          return (
            <Link
              key={idx}
              to={action.href}
              className="pro-surface pro-interactive rounded-xl p-3 flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ActionIcon size={16} />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{action.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{action.badge}</div>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-slate-400 group-hover:text-sky-500 transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SUPER ADMIN INTERACTIVE RECHARTS ANALYTICS WIDGET */}
      {/* ========================================================================= */}
      <AdminAnalyticsWidget
        studentsData={studentsData}
        usersData={usersData}
        activityLogsData={activityLogsData}
        resourcesData={resourcesData}
        examsData={examsData}
        onRefresh={() => fetchDashboardData(true)}
        isLoading={refreshing}
      />

      {/* Secondary Graphs: Inquiries & User Role Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="pro-surface rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Public Inquiries &amp; Admissions Influx
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Breakdown of incoming enrollment requests by program track.
              </p>
            </div>
            <Link to="/admin/inquiries" className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">
              View All &rarr;
            </Link>
          </div>

          <div className="h-[280px] w-full mt-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading inquiry metrics...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataInquiries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      borderRadius: '12px', 
                      border: '1px solid rgba(255, 255, 255, 0.1)', 
                      color: '#fff',
                      backdropFilter: 'blur(10px)'
                    }} 
                  />
                  <Bar dataKey="value" name="Inquiries" fill="#0284c7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        
        <div className="pro-surface rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Platform Account Role Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active accounts across Students, Staff, Parents, and School Representatives.
              </p>
            </div>
            <Link to="/admin/users" className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">
              Manage RBAC &rarr;
            </Link>
          </div>

          <div className="h-[280px] w-full mt-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading user roles...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataUsers}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartDataUsers.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      borderRadius: '12px', 
                      border: '1px solid rgba(255, 255, 255, 0.1)', 
                      color: '#fff',
                      backdropFilter: 'blur(10px)'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
