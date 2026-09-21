import { Timestamp } from 'firebase/firestore';

export type NotificationRecipientType = 
  | 'all'
  | 'all_students'
  | 'all_parents'
  | 'all_staff'
  | 'all_schools'
  | 'school'
  | 'school_students'
  | 'specific_student'
  | 'specific_parent'
  | 'specific_staff'
  | 'specific_user';

export type NotificationPriority = 'normal' | 'high' | 'urgent';

export type NotificationCategory = 
  | 'broadcast' 
  | 'announcement' 
  | 'academic' 
  | 'billing' 
  | 'exam' 
  | 'system';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: NotificationCategory | string;
  priority?: NotificationPriority;
  recipientType?: NotificationRecipientType | string;
  recipientId?: string;
  schoolId?: string;
  schoolName?: string;
  targetRole?: string;
  targetName?: string;
  targetEmail?: string;
  targetUid?: string;
  link?: string;
  linkText?: string;
  read?: boolean;
  readBy?: string[];
  timestamp?: number | Date | Timestamp | any;
  createdAt?: string | Date | Timestamp | any;
  senderName?: string;
  senderRole?: string;
}

export type NotificationFilter = 'all' | 'unread' | 'urgent' | 'academic' | 'billing' | 'system';
