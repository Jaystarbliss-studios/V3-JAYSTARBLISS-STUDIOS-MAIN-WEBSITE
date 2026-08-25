import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Bell, CheckCircle2, Clock, BookOpen, 
  ExternalLink, Trash2, Calendar, ShieldAlert,
  CheckCheck
} from 'lucide-react';
import { 
  collection, query, orderBy, limit, onSnapshot, Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'broadcast' | 'resource' | 'exam' | 'system' | 'approval';
  timestamp: number | Date | Timestamp;
  link?: string;
  read?: boolean;
  priority?: 'normal' | 'high' | 'urgent';
  recipientId?: string;
  targetRole?: string;
}

interface NotificationBellProps {
  role?: 'admin' | 'student' | 'staff' | 'parent' | 'school' | 'general';
  userId?: string;
  studentId?: string;
  schoolId?: string;
  className?: string;
  themeMode?: 'light' | 'dark' | 'auto';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  role = 'general',
  userId,
  studentId,
  schoolId,
  className = ''
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'resource' | 'exam' | 'broadcast'>('all');
  
  const [rawNotifications, setRawNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('jaystar_read_notifications');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync read status to localStorage
  const saveReadIds = (newSet: Set<string>) => {
    setReadIds(newSet);
    try {
      localStorage.setItem('jaystar_read_notifications', JSON.stringify(Array.from(newSet)));
    } catch (e) {
      console.warn('Could not save read notifications to localStorage:', e);
    }
  };

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Real-time Firestore Listeners
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // 1. Listen to Broadcast Notifications
    try {
      const notifQ = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(30));
      const unsubNotif = onSnapshot(notifQ, (snapshot) => {
        const items: AppNotification[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || 'System Notification',
            message: data.message || '',
            type: data.type || 'broadcast',
            timestamp: data.timestamp || Date.now(),
            link: data.link,
            priority: data.priority || 'normal',
            recipientId: data.recipientId,
            targetRole: data.targetRole || data.recipientId
          };
        });

        // Filter for current user role or ID
        const relevantBroadcasts = items.filter(n => {
          if (role === 'admin') return true;
          if (!n.recipientId || n.recipientId === 'all') return true;
          if (role && n.recipientId.toLowerCase().includes(role.toLowerCase())) return true;
          if (userId && n.recipientId === userId) return true;
          if (studentId && n.recipientId === studentId) return true;
          if (schoolId && n.recipientId === schoolId) return true;
          return false;
        });

        setRawNotifications(prev => {
          const others = prev.filter(p => p.type !== 'broadcast');
          return [...relevantBroadcasts, ...others];
        });
      }, (err) => {
        console.warn('Notifications snapshot note:', err.message);
      });
      unsubs.push(unsubNotif);
    } catch (e) {
      console.warn('Notifications listener init error:', e);
    }

    // 2. Listen to Published Resources (new syllabus, coding packs, lab guides)
    try {
      const resQ = query(collection(db, 'resources'), limit(15));
      const unsubRes = onSnapshot(resQ, (snapshot) => {
        const resAlerts: AppNotification[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: `res-${d.id}`,
            title: `New Resource: ${data.title || 'Curriculum Material'}`,
            message: data.description || `New ${data.category || 'learning material'} uploaded for cadets and students.`,
            type: 'resource',
            timestamp: data.timestamp || Date.now(),
            link: data.url || data.fileUrl || '/portal/resources',
            priority: 'normal'
          };
        });

        setRawNotifications(prev => {
          return [...prev.filter(p => p.type !== 'resource'), ...resAlerts];
        });
      }, (err) => {
        console.warn('Resources snapshot note:', err.message);
      });
      unsubs.push(unsubRes);
    } catch (e) {
      console.warn('Resources listener error:', e);
    }

    // 3. Listen to School Resources (if school or admin)
    if (role === 'school' || role === 'admin') {
      try {
        const sResQ = query(collection(db, 'schoolResources'), limit(15));
        const unsubSRes = onSnapshot(sResQ, (snapshot) => {
          const sResAlerts: AppNotification[] = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: `sres-${d.id}`,
              title: `School Resource: ${data.title || 'Curriculum Update'}`,
              message: data.description || `Institutional ${data.category || 'syllabus'} available for lab dispatch.`,
              type: 'resource',
              timestamp: data.timestamp || Date.now(),
              link: data.url || data.fileUrl,
              priority: 'normal'
            };
          });

          setRawNotifications(prev => {
            const filtered = prev.filter(p => !p.id.startsWith('sres-'));
            return [...filtered, ...sResAlerts];
          });
        }, () => {});
        unsubs.push(unsubSRes);
      } catch (e) {
        console.warn('School resources listener error:', e);
      }
    }

    // 4. Listen to Scheduled CBT Exams & Quizzes
    try {
      const examsQ = query(collection(db, 'schoolExams'), limit(15));
      const unsubExams = onSnapshot(examsQ, (snapshot) => {
        const examAlerts: AppNotification[] = snapshot.docs.map(d => {
          const data = d.data();
          const isLive = data.status === 'ACTIVE';
          return {
            id: `exam-${d.id}`,
            title: isLive ? `Live CBT Exam: ${data.title || 'Assessment'}` : `Upcoming Exam: ${data.title || 'Assessment'}`,
            message: `${data.subject || 'STEM Assessment'} (${data.duration || '45m'}) · Target: ${data.targetClass || 'All Cohorts'}`,
            type: 'exam',
            timestamp: data.timestamp || Date.now(),
            link: data.link || data.url || '/portal',
            priority: isLive ? 'urgent' : 'high'
          };
        });

        setRawNotifications(prev => {
          const nonExams = prev.filter(p => p.type !== 'exam');
          return [...nonExams, ...examAlerts];
        });
      }, () => {});
      unsubs.push(unsubExams);
    } catch (e) {
      console.warn('Exams listener error:', e);
    }

    return () => {
      unsubs.forEach(fn => fn());
    };
  }, [role, userId, studentId, schoolId]);

  // Combine and sort notifications
  const allNotifications = useMemo(() => {
    return [...rawNotifications].sort((a, b) => {
      const timeA = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : new Date(a.timestamp as any).getTime() || 0;
      const timeB = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : new Date(b.timestamp as any).getTime() || 0;
      return timeB - timeA;
    });
  }, [rawNotifications]);

  // Count unread
  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !readIds.has(n.id)).length;
  }, [allNotifications, readIds]);

  // Filtered list
  const displayList = useMemo(() => {
    return allNotifications.filter(n => {
      const isRead = readIds.has(n.id);
      if (activeFilter === 'unread') return !isRead;
      if (activeFilter === 'resource') return n.type === 'resource';
      if (activeFilter === 'exam') return n.type === 'exam';
      if (activeFilter === 'broadcast') return n.type === 'broadcast' || n.type === 'system';
      return true;
    });
  }, [allNotifications, activeFilter, readIds]);

  const markAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = new Set(readIds);
    updated.add(id);
    saveReadIds(updated);
  };

  const markAllAsRead = () => {
    const updated = new Set(readIds);
    allNotifications.forEach(n => updated.add(n.id));
    saveReadIds(updated);
    toast.success('All notifications marked as read.');
  };

  const clearAllNotifications = () => {
    markAllAsRead();
    toast.info('Notifications acknowledged.');
    setIsOpen(false);
  };

  const formatRelativeTime = (ts: any) => {
    if (!ts) return 'Just now';
    let millis = 0;
    if (ts instanceof Timestamp) millis = ts.toMillis();
    else if (typeof ts === 'number') millis = ts;
    else if (ts instanceof Date) millis = ts.getTime();
    else {
      const parsed = new Date(ts).getTime();
      millis = isNaN(parsed) ? Date.now() : parsed;
    }

    const diffSec = Math.max(0, Math.floor((Date.now() - millis) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return new Date(millis).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: string, priority?: string) => {
    if (priority === 'urgent') return <ShieldAlert className="text-red-500" size={16} />;
    switch (type) {
      case 'resource':
        return <BookOpen className="text-blue-500" size={16} />;
      case 'exam':
        return <Calendar className="text-amber-500" size={16} />;
      case 'system':
      case 'approval':
        return <CheckCircle2 className="text-emerald-500" size={16} />;
      default:
        return <Bell className="text-brand-red" size={16} />;
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        id="header-notification-bell"
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="relative p-2.5 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red"
        aria-label="View notifications"
        title="Notifications & Updates"
      >
        <Bell size={19} className="transition-transform active:scale-95" />
        
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-brand-red text-[10px] font-black text-white shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? '9+' : unreadCount}
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping -z-10" />
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover */}
      {isOpen && (
        <div 
          id="notification-popover-dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/70 dark:bg-slate-900/80 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center font-bold">
                <Bell size={14} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                  Notifications &amp; Alerts
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-slate-400">
                  {unreadCount === 0 ? 'All caught up' : `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-brand-red hover:text-red-700 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                title="Mark all notifications as read"
              >
                <CheckCheck size={13} />
                <span>Mark read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white dark:bg-slate-900">
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: `Unread (${unreadCount})` },
              { key: 'resource', label: 'Resources' },
              { key: 'exam', label: 'Exams' },
              { key: 'broadcast', label: 'Alerts' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                  activeFilter === tab.key
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60">
            {displayList.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 mx-auto flex items-center justify-center">
                  <Bell size={18} />
                </div>
                <p className="text-xs font-bold text-gray-700 dark:text-slate-300">
                  No notifications in this filter
                </p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                  New resources, live exam windows, and broadcasts will appear in real-time.
                </p>
              </div>
            ) : (
              displayList.map((item) => {
                const isRead = readIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      markAsRead(item.id);
                      if (item.link) {
                        setIsOpen(false);
                        window.location.href = item.link;
                      }
                    }}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                      !isRead 
                        ? 'bg-red-50/40 dark:bg-red-950/15 hover:bg-red-50/80 dark:hover:bg-red-950/25' 
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      {getNotificationIcon(item.type, item.priority)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className={`text-xs font-bold truncate ${
                          !isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-300'
                        }`}>
                          {item.title}
                        </h4>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-brand-red shrink-0" />
                        )}
                      </div>

                      <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[10px] text-gray-400 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatRelativeTime(item.timestamp)}
                        </span>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.link && (
                            <span className="text-brand-red font-bold flex items-center gap-0.5 hover:underline">
                              Open <ExternalLink size={10} />
                            </span>
                          )}
                          {!isRead && (
                            <button
                              type="button"
                              onClick={(e) => markAsRead(item.id, e)}
                              className="text-gray-400 hover:text-emerald-500"
                              title="Mark as read"
                            >
                              <CheckCircle2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {allNotifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 flex items-center justify-between text-[11px]">
              <span className="text-gray-500 dark:text-slate-400">
                {allNotifications.length} total broadcast{allNotifications.length > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={clearAllNotifications}
                className="text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white font-medium flex items-center gap-1 transition-colors"
              >
                <Trash2 size={11} />
                <span>Dismiss</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
