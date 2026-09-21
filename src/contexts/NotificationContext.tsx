import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  collection, query, where, orderBy, limit, onSnapshot, 
  doc, updateDoc, arrayUnion, arrayRemove, getDocs, Timestamp 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { AppNotification, NotificationFilter } from '../types/notifications';
import { useToast } from './ToastContext';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  isDrawerOpen: boolean;
  selectedNotification: AppNotification | null;
  activeFilter: NotificationFilter;
  searchQuery: string;
  setActiveFilter: (filter: NotificationFilter) => void;
  setSearchQuery: (query: string) => void;
  openDrawer: (notificationId?: string) => void;
  closeDrawer: () => void;
  selectNotification: (notification: AppNotification | null) => void;
  markAsRead: (id: string, e?: React.MouseEvent) => Promise<void>;
  markAsUnread: (id: string, e?: React.MouseEvent) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  isNotificationRead: (notification: AppNotification) => boolean;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [userRole, setUserRole] = useState<string>('');
  const [schoolId, setSchoolId] = useState<string>('');
  const [studentDocId, setStudentDocId] = useState<string>('');
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Local storage read state keyed strictly by user UID
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());

  // Watch Auth State and Session Role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Load role & identifiers from sessionStorage or cached storage
        const r = (sessionStorage.getItem('userRole') || localStorage.getItem('jaystar_cached_user_role') || '').toLowerCase();
        const sId = sessionStorage.getItem('schoolId') || sessionStorage.getItem('schoolDocId') || '';
        const stId = sessionStorage.getItem('studentDocId') || '';
        setUserRole(r);
        setSchoolId(sId);
        setStudentDocId(stId);

        // Load local read IDs for this specific user
        try {
          const stored = localStorage.getItem(`jaystar_notif_read_${user.uid}`);
          if (stored) {
            setLocalReadIds(new Set(JSON.parse(stored)));
          } else {
            setLocalReadIds(new Set());
          }
        } catch {
          setLocalReadIds(new Set());
        }
      } else {
        setUserRole('');
        setSchoolId('');
        setStudentDocId('');
        setNotifications([]);
        setLocalReadIds(new Set());
      }
    });

    return () => unsub();
  }, []);

  // Save to user-scoped local storage
  const saveLocalReadState = useCallback((uid: string, newSet: Set<string>) => {
    setLocalReadIds(newSet);
    try {
      localStorage.setItem(`jaystar_notif_read_${uid}`, JSON.stringify(Array.from(newSet)));
    } catch (e) {
      console.warn('Could not save read notifications to localStorage:', e);
    }
  }, []);

  // Check if a notification is considered read
  const isNotificationRead = useCallback((notification: AppNotification): boolean => {
    if (!currentUser) return false;
    const uid = currentUser.uid;

    // 1. Direct match on local memory/storage
    if (localReadIds.has(notification.id)) return true;

    // 2. Firestore readBy array includes user's UID
    if (Array.isArray(notification.readBy) && notification.readBy.includes(uid)) {
      return true;
    }

    // 3. Direct targeted 1-to-1 notification with read === true
    if (notification.recipientId === uid && notification.read === true) {
      return true;
    }

    return false;
  }, [currentUser, localReadIds]);

  // Real-time Firestore query listener
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const uid = currentUser.uid;
    const email = currentUser.email?.toLowerCase() || '';
    const role = userRole || (sessionStorage.getItem('userRole') || '').toLowerCase();
    const currentSchoolId = schoolId || sessionStorage.getItem('schoolId') || sessionStorage.getItem('schoolDocId') || '';
    const currentStudentDocId = studentDocId || sessionStorage.getItem('studentDocId') || '';

    const isAdmin = ['super_admin', 'admin', 'content_admin', 'education_admin', 'services_admin', 'marketing_admin', 'support_admin'].includes(role);

    setLoading(true);
    const unsubs: (() => void)[] = [];
    const notificationMap = new Map<string, AppNotification>();

    const updateFromDocs = (docs: any[]) => {
      docs.forEach(docSnap => {
        const data = docSnap.data();
        const notif: AppNotification = {
          id: docSnap.id,
          title: data.title || 'System Notification',
          message: data.message || '',
          type: data.type || 'broadcast',
          priority: data.priority || 'normal',
          recipientType: data.recipientType || (data.recipientId === 'all' ? 'all' : undefined),
          recipientId: data.recipientId,
          schoolId: data.schoolId,
          schoolName: data.schoolName,
          targetRole: data.targetRole,
          targetName: data.targetName,
          targetEmail: data.targetEmail,
          targetUid: data.targetUid,
          link: data.link,
          linkText: data.linkText,
          read: data.read,
          readBy: Array.isArray(data.readBy) ? data.readBy : [],
          timestamp: data.timestamp || data.createdAt || Date.now(),
          createdAt: data.createdAt,
          senderName: data.senderName || 'Jaystar Central',
          senderRole: data.senderRole || 'Administration'
        };

        // Strict Audience Filtering: ensure only meant for this user
        let isRelevant = false;
        if (isAdmin) {
          isRelevant = true;
        } else if (notif.recipientId === 'all' || notif.recipientType === 'all') {
          isRelevant = true;
        } else if (notif.recipientId === uid || notif.targetUid === uid) {
          isRelevant = true;
        } else if (notif.targetEmail && email && notif.targetEmail.toLowerCase() === email) {
          isRelevant = true;
        } else if (role === 'student') {
          if (notif.recipientId === 'all_students' || notif.recipientType === 'all_students') isRelevant = true;
          if (currentStudentDocId && notif.recipientId === currentStudentDocId) isRelevant = true;
          if (currentSchoolId && (notif.recipientId === `school_students_${currentSchoolId}` || (notif.schoolId === currentSchoolId && notif.recipientType === 'school_students'))) isRelevant = true;
        } else if (role === 'parent') {
          if (notif.recipientId === 'all_parents' || notif.recipientType === 'all_parents') isRelevant = true;
        } else if (['staff', 'tutor', 'instructor'].includes(role)) {
          if (notif.recipientId === 'all_staff' || notif.recipientType === 'all_staff') isRelevant = true;
        } else if (role === 'school') {
          if (notif.recipientId === 'all_schools' || notif.recipientType === 'all_schools') isRelevant = true;
          if (currentSchoolId && (notif.recipientId === currentSchoolId || notif.recipientId === `school_${currentSchoolId}` || notif.schoolId === currentSchoolId)) isRelevant = true;
        }

        if (isRelevant) {
          notificationMap.set(notif.id, notif);
        }
      });

      // Sort newest first
      const sortedList = Array.from(notificationMap.values()).sort((a, b) => {
        const timeA = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime() || 0;
        const timeB = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime() || 0;
        return timeB - timeA;
      });

      setNotifications(sortedList);
      setLoading(false);
    };

    try {
      if (isAdmin) {
        // Admin gets general feed
        const adminQ = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(100));
        const unsub = onSnapshot(adminQ, (snap) => {
          updateFromDocs(snap.docs);
        }, (err) => {
          console.warn('Admin notifications stream warning:', err);
          // Fallback simple query
          getDocs(collection(db, 'notifications')).then(snap => updateFromDocs(snap.docs)).catch(() => {});
        });
        unsubs.push(unsub);
      } else {
        // Build specific targeted listeners
        const queryList = [
          query(collection(db, 'notifications'), where('recipientId', '==', 'all'), limit(30)),
          query(collection(db, 'notifications'), where('recipientId', '==', uid), limit(30))
        ];

        if (role === 'student') {
          queryList.push(query(collection(db, 'notifications'), where('recipientId', '==', 'all_students'), limit(30)));
          if (currentStudentDocId) {
            queryList.push(query(collection(db, 'notifications'), where('recipientId', '==', currentStudentDocId), limit(30)));
          }
          if (currentSchoolId) {
            queryList.push(query(collection(db, 'notifications'), where('recipientId', '==', `school_students_${currentSchoolId}`), limit(30)));
            queryList.push(query(collection(db, 'notifications'), where('schoolId', '==', currentSchoolId), limit(30)));
          }
        } else if (role === 'parent') {
          queryList.push(query(collection(db, 'notifications'), where('recipientId', '==', 'all_parents'), limit(30)));
        } else if (['staff', 'tutor', 'instructor'].includes(role)) {
          queryList.push(query(collection(db, 'notifications'), where('recipientId', '==', 'all_staff'), limit(30)));
        } else if (role === 'school') {
          queryList.push(query(collection(db, 'notifications'), where('recipientId', '==', 'all_schools'), limit(30)));
          if (currentSchoolId) {
            queryList.push(query(collection(db, 'notifications'), where('recipientId', '==', currentSchoolId), limit(30)));
            queryList.push(query(collection(db, 'notifications'), where('recipientId', '==', `school_${currentSchoolId}`), limit(30)));
          }
        }

        queryList.forEach(q => {
          const unsub = onSnapshot(q, (snap) => {
            updateFromDocs(snap.docs);
          }, (err) => {
            console.warn('Targeted notification stream note:', err.message);
          });
          unsubs.push(unsub);
        });
      }
    } catch (e) {
      console.warn('Notification listener initialization error:', e);
      setLoading(false);
    }

    return () => {
      unsubs.forEach(u => u());
    };
  }, [currentUser, userRole, schoolId, studentDocId]);

  // Unread Count
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !isNotificationRead(n)).length;
  }, [notifications, isNotificationRead]);

  // Mark a single notification as read
  const markAsRead = useCallback(async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) return;
    const uid = currentUser.uid;

    // 1. Instant optimistic local update
    const nextSet = new Set(localReadIds);
    nextSet.add(id);
    saveLocalReadState(uid, nextSet);

    // Update in-memory state
    setNotifications(prev => prev.map(item => {
      if (item.id === id) {
        const readBy = Array.isArray(item.readBy) ? item.readBy : [];
        return {
          ...item,
          read: true,
          readBy: readBy.includes(uid) ? readBy : [...readBy, uid]
        };
      }
      return item;
    }));

    if (selectedNotification && selectedNotification.id === id) {
      setSelectedNotification(prev => prev ? { ...prev, read: true, readBy: [...(prev.readBy || []), uid] } : null);
    }

    // 2. Persist to Firestore
    try {
      const notifRef = doc(db, 'notifications', id);
      await updateDoc(notifRef, {
        readBy: arrayUnion(uid),
        read: true
      });
    } catch (err: any) {
      console.warn('Firestore read state update note:', err.message);
    }
  }, [currentUser, localReadIds, saveLocalReadState, selectedNotification]);

  // Mark a single notification as unread
  const markAsUnread = useCallback(async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) return;
    const uid = currentUser.uid;

    // 1. Instant optimistic local update
    const nextSet = new Set(localReadIds);
    nextSet.delete(id);
    saveLocalReadState(uid, nextSet);

    // Update in-memory state
    setNotifications(prev => prev.map(item => {
      if (item.id === id) {
        const readBy = (item.readBy || []).filter(u => u !== uid);
        return {
          ...item,
          read: false,
          readBy
        };
      }
      return item;
    }));

    if (selectedNotification && selectedNotification.id === id) {
      setSelectedNotification(prev => prev ? { ...prev, read: false, readBy: (prev.readBy || []).filter(u => u !== uid) } : null);
    }

    // 2. Persist to Firestore
    try {
      const notifRef = doc(db, 'notifications', id);
      await updateDoc(notifRef, {
        readBy: arrayRemove(uid),
        read: false
      });
      toast.info('Marked as unread');
    } catch (err: any) {
      console.warn('Firestore unread state update note:', err.message);
    }
  }, [currentUser, localReadIds, saveLocalReadState, selectedNotification, toast]);

  // Mark all currently visible notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUser || notifications.length === 0) return;
    const uid = currentUser.uid;

    // 1. Instant optimistic update
    const nextSet = new Set(localReadIds);
    notifications.forEach(n => nextSet.add(n.id));
    saveLocalReadState(uid, nextSet);

    setNotifications(prev => prev.map(item => ({
      ...item,
      read: true,
      readBy: Array.isArray(item.readBy) && item.readBy.includes(uid) ? item.readBy : [...(item.readBy || []), uid]
    })));

    toast.success('All notifications marked as read.');

    // 2. Batch Firestore updates asynchronously
    try {
      await Promise.allSettled(
        notifications.map(n => 
          updateDoc(doc(db, 'notifications', n.id), {
            readBy: arrayUnion(uid),
            read: true
          })
        )
      );
    } catch (err) {
      console.warn('Batch mark all read note:', err);
    }
  }, [currentUser, notifications, localReadIds, saveLocalReadState, toast]);

  // Open Drawer and optionally pick a notification
  const openDrawer = useCallback((notificationId?: string) => {
    setIsDrawerOpen(true);
    if (notificationId) {
      const found = notifications.find(n => n.id === notificationId);
      if (found) {
        setSelectedNotification(found);
        markAsRead(found.id);
      }
    }
  }, [notifications, markAsRead]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const selectNotification = useCallback((notification: AppNotification | null) => {
    setSelectedNotification(notification);
    if (notification) {
      markAsRead(notification.id);
    }
  }, [markAsRead]);

  const refreshNotifications = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(50)));
      const items: AppNotification[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as AppNotification));
      setNotifications(items);
    } catch (e) {
      console.warn('Refresh notifications note:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        isDrawerOpen,
        selectedNotification,
        activeFilter,
        searchQuery,
        setActiveFilter,
        setSearchQuery,
        openDrawer,
        closeDrawer,
        selectNotification,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        isNotificationRead,
        refreshNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
