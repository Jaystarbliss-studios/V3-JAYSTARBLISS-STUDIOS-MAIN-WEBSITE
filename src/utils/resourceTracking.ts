import { useEffect, useState, useCallback } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const STORAGE_PREFIX = 'jaystar_read_resources_';

/**
 * Get the storage key for read resources based on user UID or guest fallback
 */
export function getReadResourcesStorageKey(userId?: string): string {
  const uid = userId || auth.currentUser?.uid || 'guest_user';
  return `${STORAGE_PREFIX}${uid}`;
}

/**
 * Retrieve set of read resource IDs from localStorage
 */
export function getReadResourceIds(userId?: string): Set<string> {
  try {
    const key = getReadResourcesStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    console.warn('Failed reading read resources from localStorage:', e);
    return new Set<string>();
  }
}

/**
 * Persist set of read resource IDs
 */
export function saveReadResourceIds(readIds: Set<string>, userId?: string): void {
  try {
    const key = getReadResourcesStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(Array.from(readIds)));
    // Dispatch custom event so any listener updates state in real-time
    window.dispatchEvent(new CustomEvent('jaystar-resource-read-changed', {
      detail: { readIds: Array.from(readIds), userId: userId || auth.currentUser?.uid }
    }));
  } catch (e) {
    console.warn('Failed saving read resources to localStorage:', e);
  }
}

/**
 * Mark a single resource as read
 */
export function markResourceAsRead(resourceId: string, userId?: string): void {
  if (!resourceId) return;
  const current = getReadResourceIds(userId);
  if (!current.has(resourceId)) {
    current.add(resourceId);
    saveReadResourceIds(current, userId);
  }
}

/**
 * Mark a single resource as unread
 */
export function markResourceAsUnread(resourceId: string, userId?: string): void {
  if (!resourceId) return;
  const current = getReadResourceIds(userId);
  if (current.has(resourceId)) {
    current.delete(resourceId);
    saveReadResourceIds(current, userId);
  }
}

/**
 * Mark multiple resources as read
 */
export function markAllResourcesAsRead(resourceIds: string[], userId?: string): void {
  const current = getReadResourceIds(userId);
  resourceIds.forEach(id => current.add(id));
  saveReadResourceIds(current, userId);
}

/**
 * Custom React hook for tracking and updating read resources across dashboards
 */
export function useResourceReadTracker(customUserId?: string) {
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadResourceIds(customUserId));

  // Sync with auth changes and window custom events
  useEffect(() => {
    const sync = () => {
      setReadIds(getReadResourceIds(customUserId));
    };

    sync();

    const handleEvent = (event: Event) => {
      const customEvt = event as CustomEvent;
      if (customEvt.detail?.readIds) {
        setReadIds(new Set(customEvt.detail.readIds));
      } else {
        sync();
      }
    };

    window.addEventListener('jaystar-resource-read-changed', handleEvent);
    return () => {
      window.removeEventListener('jaystar-resource-read-changed', handleEvent);
    };
  }, [customUserId]);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  const markRead = useCallback((id: string) => {
    markResourceAsRead(id, customUserId);
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [customUserId]);

  const markUnread = useCallback((id: string) => {
    markResourceAsUnread(id, customUserId);
    setReadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [customUserId]);

  const markAllRead = useCallback((ids: string[]) => {
    markAllResourcesAsRead(ids, customUserId);
    setReadIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }, [customUserId]);

  return {
    readIds,
    isRead,
    markRead,
    markUnread,
    markAllRead,
    unreadCount: (allIds: string[]) => allIds.filter(id => !readIds.has(id)).length
  };
}

/**
 * Date range filter evaluation helper
 */
export type DateFilterType = 'all' | 'recent' | 'last_week' | 'last_month' | 'last_90_days' | 'oldest';

export function matchesDateFilter(dateVal: any, filter: DateFilterType): boolean {
  if (filter === 'all' || filter === 'recent' || filter === 'oldest') return true;

  if (!dateVal) return false;
  let timeMs = 0;
  if (typeof dateVal === 'string') {
    timeMs = new Date(dateVal).getTime();
  } else if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    timeMs = dateVal.toDate().getTime();
  } else if (dateVal.seconds) {
    timeMs = dateVal.seconds * 1000;
  } else if (dateVal instanceof Date) {
    timeMs = dateVal.getTime();
  }

  if (!timeMs || isNaN(timeMs)) return false;
  const now = Date.now();
  const diffMs = now - timeMs;

  switch (filter) {
    case 'last_week': // 7 days
      return diffMs <= 7 * 24 * 60 * 60 * 1000;
    case 'last_month': // 30 days
      return diffMs <= 30 * 24 * 60 * 60 * 1000;
    case 'last_90_days': // 90 days
      return diffMs <= 90 * 24 * 60 * 60 * 1000;
    default:
      return true;
  }
}

/**
 * Trigger a notification to users when a resource is uploaded, shared or assigned
 */
export interface ResourceNotificationParams {
  title: string;
  description?: string;
  subject?: string;
  classLevel?: string;
  assignedClasses?: string[];
  docType?: string;
  schoolId?: string;
  schoolName?: string;
  targetRole?: 'student' | 'school' | 'staff' | 'all';
  recipientType?: string;
  recipientId?: string;
  uploaderName?: string;
  customLink?: string;
}

export async function triggerResourceNotification(params: ResourceNotificationParams): Promise<string | null> {
  try {
    const {
      title,
      description,
      subject,
      classLevel,
      assignedClasses,
      docType = 'Learning Resource',
      schoolId,
      schoolName,
      targetRole = 'student',
      recipientType,
      recipientId,
      uploaderName,
      customLink
    } = params;

    const classDetails = assignedClasses && assignedClasses.length > 0
      ? assignedClasses.join(', ')
      : (classLevel || 'all enrolled learners');

    let resolvedRecipientId = recipientId;
    let resolvedRecipientType = recipientType;

    if (!resolvedRecipientId) {
      if (schoolId) {
        resolvedRecipientId = `school_students_${schoolId}`;
        resolvedRecipientType = 'school_students';
      } else if (targetRole === 'staff') {
        resolvedRecipientId = 'all_staff';
        resolvedRecipientType = 'all_staff';
      } else if (targetRole === 'school') {
        resolvedRecipientId = 'all_schools';
        resolvedRecipientType = 'all_schools';
      } else {
        resolvedRecipientId = 'all_students';
        resolvedRecipientType = 'all_students';
      }
    }

    const docRef = await addDoc(collection(db, 'notifications'), {
      title: `New Resource: ${title}`,
      message: `${schoolName ? `${schoolName}: ` : ''}A new ${subject ? `${subject} ` : ''}${docType} "${title}" has been published for ${classDetails}. ${description ? `Description: ${description.slice(0, 140)}...` : 'Tap to open or download.'}`,
      type: 'academic',
      priority: 'normal',
      recipientId: resolvedRecipientId,
      recipientType: resolvedRecipientType || 'all_students',
      schoolId: schoolId || undefined,
      schoolName: schoolName || undefined,
      targetRole,
      link: customLink || '/portal/student/resources',
      linkText: 'Open Resource',
      read: false,
      readBy: [],
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      senderName: uploaderName || 'Academic Team'
    });

    return docRef.id;
  } catch (error) {
    console.warn('Failed to publish resource notification:', error);
    return null;
  }
}
