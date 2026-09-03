import React, { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, limit, onSnapshot 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Activity, Search, Clock, 
  UserCheck, Send, School, LogIn
} from 'lucide-react';

const AdminActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const getLogIcon = (type: string) => {
    if (type?.includes('login')) return <LogIn size={16} className="text-emerald-500" />;
    if (type?.includes('approval') || type?.includes('approved')) return <UserCheck size={16} className="text-blue-500" />;
    if (type?.includes('resource')) return <Send size={16} className="text-brand-red" />;
    if (type?.includes('school')) return <School size={16} className="text-amber-500" />;
    return <Activity size={16} className="text-gray-400" />;
  };

  const formatLogDescription = (item: any) => {
    if (item.type === 'login') return `${item.userType || 'User'} logged in: ${item.userEmail || ''}`;
    if (item.type === 'logout') return `${item.userType || 'User'} logged out: ${item.userEmail || ''}`;
    if (item.type === 'staff_resource_sent') return `Staff ${item.staffEmail || 'member'} dispatched "${item.resourceTitle || 'Resource'}" to student`;
    if (item.type === 'staff_school_resource_sent') return `Staff ${item.staffEmail || 'member'} dispatched "${item.resourceTitle || 'Resource'}" to school`;
    if (item.type === 'student_added') return `Staff ${item.staffEmail || 'member'} registered student: ${item.studentUsername || ''}`;
    if (item.type === 'student_request_approved') return `Approved student application (ID: ${item.studentId || ''}) · Access credentials generated.`;
    if (item.type === 'enrollment_approved') return `Approved family enrollment for ${item.studentName || 'Student'} (ID: ${item.studentId || ''})`;
    
    return item.message || item.description || item.type || 'System transaction recorded.';
  };

  const filteredLogs = logs.filter(l => {
    const matchesFilter = filterType === 'all' || l.type?.includes(filterType);
    const desc = formatLogDescription(l).toLowerCase();
    const matchesSearch = desc.includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-slate dark:text-white flex items-center gap-3">
            <Activity className="text-brand-red w-8 h-8" />
            System &amp; Activity Audit Logs
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time security telemetry, authentication events, curriculum dispatches, and enrollment confirmations.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All Activities' },
          { key: 'login', label: 'Authentication & Logins' },
          { key: 'approved', label: 'Approvals & Enrollments' },
          { key: 'resource', label: 'Curriculum Dispatches' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filterType === f.key
                ? 'bg-brand-slate dark:bg-white text-white dark:text-brand-slate shadow-sm'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 font-mono text-xs">Loading live telemetry stream...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No activity records found matching current query.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {filteredLogs.map((item) => (
              <div key={item.id} className="p-4 sm:p-5 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                  {getLogIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
                    {formatLogDescription(item)}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-1 flex items-center gap-1.5">
                    <Clock size={12} />
                    {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : 'Just now'}
                  </div>
                </div>

                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-gray-500 shrink-0">
                  {item.type || 'EVENT'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminActivityLogs;
