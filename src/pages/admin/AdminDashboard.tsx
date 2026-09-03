import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, BookOpen, Download, 
  RefreshCw, School, Award
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

const COLORS = ['#B91C1C', '#1E293B', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

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
    { name: 'Enrolled Cadets', value: metrics.students, icon: Users, color: 'bg-brand-red', href: '/admin/students', badge: 'Active Cohorts' },
    { name: 'Partner Schools', value: metrics.schools, icon: School, color: 'bg-slate-800', href: '/admin/schools', badge: 'Montessori Portals' },
    { name: 'Curriculum Guides', value: metrics.resources, icon: BookOpen, color: 'bg-blue-600', href: '/admin/resources', badge: 'PDF & Labs' },
    { name: 'CBT Assessments', value: metrics.exams, icon: Award, color: 'bg-emerald-600', href: '/admin/schools', badge: 'Testing Windows' },
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
    <div className="dashboard-interface space-y-8">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Super Admin Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
            System health, student growth trajectory, portal login frequencies, and curriculum engagement metrics.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            type="button"
            onClick={() => exportToCSV(studentsData.length > 0 ? studentsData : usersData, 'students_cadets_registry')}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            <Download size={14} /> Export Students
          </button>
          
          <button 
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 bg-brand-red hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
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
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    {item.name}
                  </span>
                  <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                    {loading ? '...' : item.value}
                  </div>
                </div>
                <div className={`${item.color} rounded-xl p-3 text-white shadow-xs`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-slate-400 font-medium text-[11px]">
                  {item.badge}
                </span>
                <Link to={item.href} className="font-bold text-brand-red hover:text-red-700 transition-colors">
                  Manage &rarr;
                </Link>
              </div>
            </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="pro-surface rounded-3xl p-6 md:p-8 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Public Inquiries &amp; Admissions Influx
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Breakdown of incoming enrollment requests by program track.
              </p>
            </div>
            <Link to="/admin/inquiries" className="text-xs font-bold text-brand-red hover:underline">
              View All Inquiries
            </Link>
          </div>

          <div className="h-[280px] w-full mt-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">Loading inquiry metrics...</div>
            ) : chartDataInquiries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">No inquiry data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataInquiries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '12px', 
                      border: 'none', 
                      color: '#fff' 
                    }} 
                  />
                  <Bar dataKey="value" name="Inquiries" fill="#B91C1C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        
        <div className="pro-surface rounded-3xl p-6 md:p-8 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Platform Account Role Distribution
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Active accounts across Students, Staff, Parents, and School Representatives.
              </p>
            </div>
            <Link to="/admin/users" className="text-xs font-bold text-brand-red hover:underline">
              Manage RBAC
            </Link>
          </div>

          <div className="h-[280px] w-full mt-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">Loading user roles...</div>
            ) : chartDataUsers.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">No account data yet.</div>
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
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '12px', 
                      border: 'none', 
                      color: '#fff' 
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
