import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Loader2 } from 'lucide-react';
import ChangePasswordModal from '../portal/ChangePasswordModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectPath?: string;
}

const blockedStatuses = ['banned', 'suspended', 'disabled'];
const adminRoles = [
  'SUPER_ADMIN', 
  'ADMIN', 
  'CMS_ADMIN', 
  'ACADEMIC_ADMIN', 
  'FINANCE_ADMIN', 
  'CONTENT_ADMIN', 
  'EDUCATION_ADMIN', 
  'SERVICES_ADMIN', 
  'MARKETING_ADMIN', 
  'SUPPORT_ADMIN'
];

const isSubAdminAllowedForPath = (role: string, pathname: string): boolean => {
  const norm = role.toUpperCase();
  if (norm === 'SUPER_ADMIN' || norm === 'ADMIN') return true;

  if (norm === 'CMS_ADMIN' || norm === 'CONTENT_ADMIN') {
    const cmsAllowed = ['/admin', '/admin/pages', '/admin/programs', '/admin/services', '/admin/portfolio', '/admin/kids-projects', '/admin/blog', '/admin/inquiries', '/admin/notifications'];
    return cmsAllowed.some(p => pathname === p || (pathname.startsWith(p) && p !== '/admin'));
  }

  if (norm === 'ACADEMIC_ADMIN' || norm === 'EDUCATION_ADMIN') {
    if (pathname.startsWith('/admin/billing') || pathname.startsWith('/admin/users') || pathname.startsWith('/admin/settings')) {
      return false;
    }
    const academicAllowed = ['/admin', '/admin/inquiries', '/admin/approvals', '/admin/students', '/admin/staff', '/admin/tutor-subjects', '/admin/schools', '/admin/schedules', '/admin/resources', '/admin/programs', '/admin/notifications'];
    return academicAllowed.some(p => pathname === p || (pathname.startsWith(p) && p !== '/admin'));
  }

  if (norm === 'FINANCE_ADMIN') {
    const financeAllowed = ['/admin', '/admin/billing', '/admin/approvals', '/admin/activity', '/admin/notifications'];
    return financeAllowed.some(p => pathname === p || (pathname.startsWith(p) && p !== '/admin'));
  }

  return true;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, redirectPath = '/portal' }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const location = useLocation();
  const rolesKey = allowedRoles ? allowedRoles.slice().sort().join(',') : '';

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (!mounted) return;
      setLoading(true);
      setBlockedMessage(null);
      setIsAuthorized(false);
      try {
        if (!currentUser) return;
        let userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        
        // Self-heal for admin routes if accessing /admin or if user is known admin
        if (location.pathname.startsWith('/admin') || currentUser.email === 'johnrufai242@gmail.com') {
          try {
            const idToken = await currentUser.getIdToken(true);
            const adminSyncResponse = await fetch('/.netlify/functions/admin-auth-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            });
            const adminSyncData = await adminSyncResponse.json().catch(() => ({}));
            if (adminSyncResponse.ok && adminSyncData.isAdmin) {
              const refreshed = await getDoc(doc(db, 'users', currentUser.uid));
              if (refreshed.exists()) userSnap = refreshed;
            }
          } catch (adminSyncErr) {
            console.warn('Admin auth sync check:', adminSyncErr);
          }
        } else if (location.pathname.startsWith('/portal/school')) {
          // Self-heal for school route if user profile or role/schoolId is missing
          try {
            const idToken = await currentUser.getIdToken(true);
            const syncResponse = await fetch('/.netlify/functions/admin-school-admin-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
              body: JSON.stringify({ scope: 'single', email: currentUser.email || '' }),
            });
            const syncData = await syncResponse.json().catch(() => ({}));
            if (syncResponse.ok && syncData?.results?.[0]?.status === 'LINKED') {
              const refreshed = await getDoc(doc(db, 'users', currentUser.uid));
              if (refreshed.exists()) userSnap = refreshed;
            }
          } catch (repairError) {
            console.warn('School administrator link repair check:', repairError);
          }
        }

        if (!userSnap.exists()) {
          await signOut(auth).catch(() => undefined);
          throw new Error('Authenticated user has no authoritative portal profile.');
        }

        let data = userSnap.data() || {};
        const accountStatus = String(data.accountStatus || data.status || 'ACTIVE').toUpperCase();
        if (blockedStatuses.includes(accountStatus.toLowerCase())) {
          if (mounted) setBlockedMessage(`Your account is currently ${accountStatus.toLowerCase()}. Please contact Jaystarbliss Studios support.`);
          await signOut(auth).catch(() => undefined);
          return;
        }

        let role = String(data.role || '').trim().toUpperCase();

        // Check if active user is an Admin impersonating another role
        const isUserAdmin = adminRoles.includes(role) || currentUser.email === 'johnrufai242@gmail.com';
        const masqueradeRaw = sessionStorage.getItem('admin_masquerade');
        let masquerade: any = null;
        if (masqueradeRaw) {
          try {
            masquerade = JSON.parse(masqueradeRaw);
          } catch {
            masquerade = null;
          }
        }

        if (isUserAdmin && masquerade && masquerade.isMasquerading) {
          const targetRole = String(masquerade.targetRole || 'STUDENT').toUpperCase();
          const targetUser = masquerade.targetUser || {};
          const isAllowedForTarget = allowedRoles?.length
            ? allowedRoles.some(candidate => candidate.toUpperCase() === targetRole)
            : true;

          if (isAllowedForTarget) {
            sessionStorage.setItem('userRole', targetRole.toLowerCase());
            sessionStorage.setItem('userId', targetUser.uid || targetUser.id || currentUser.uid);
            sessionStorage.setItem('userEmail', targetUser.email || '');
            if (targetUser.name || targetUser.fullName) {
              sessionStorage.setItem('userName', String(targetUser.name || targetUser.fullName));
            }
            if (targetUser.schoolId) {
              sessionStorage.setItem('schoolId', String(targetUser.schoolId));
            }
            if (targetUser.studentDocId || targetUser.id) {
              sessionStorage.setItem('studentDocId', String(targetUser.studentDocId || targetUser.id));
            }
            if (targetUser.class || targetUser.classLevel) {
              sessionStorage.setItem('studentClass', String(targetUser.class || targetUser.classLevel));
            }
            if (mounted) {
              setIsAuthorized(true);
              setLoading(false);
            }
            return;
          }
        }

        // School administrators can arrive here with an authenticated Firebase
        // session but without the legacy schoolId field. Repair the approved
        // mapping server-side before deciding whether the portal is authorized.
        if ((role === 'SCHOOL' || location.pathname.startsWith('/portal/school')) && !String(data.schoolId || '').trim()) {
          try {
            const idToken = await currentUser.getIdToken(true);
            const syncResponse = await fetch('/.netlify/functions/admin-school-admin-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
              body: JSON.stringify({ scope: 'single', email: currentUser.email || data.email || '' }),
            });
            const syncData = await syncResponse.json().catch(() => ({}));
            if (syncResponse.ok && syncData?.results?.[0]?.status === 'LINKED') {
              const refreshed = await getDoc(doc(db, 'users', currentUser.uid));
              if (refreshed.exists()) {
                data = refreshed.data() || {};
                role = String(data.role || 'SCHOOL').trim().toUpperCase();
              }
            }
          } catch (repairError) {
            console.warn('School administrator link repair failed:', repairError);
          }
        }

        if (!role) {
          await signOut(auth).catch(() => undefined);
          throw new Error('Authenticated user has no authoritative portal role.');
        }

        const allowed = allowedRoles?.length
          ? allowedRoles.some(candidate => candidate.toUpperCase() === role)
          : location.pathname.startsWith('/admin')
            ? (adminRoles.includes(role) && isSubAdminAllowedForPath(role, location.pathname))
            : true;

        if (!allowed) {
          if (mounted) setIsAuthorized(false);
          return;
        }

        sessionStorage.setItem('userRole', role.toLowerCase());
        sessionStorage.setItem('userId', currentUser.uid);
        sessionStorage.setItem('userEmail', currentUser.email || String(data.email || ''));
        if (data.name) sessionStorage.setItem('userName', String(data.name));
        if (data.schoolId) sessionStorage.setItem('schoolId', String(data.schoolId));
        if (data.studentDocId) sessionStorage.setItem('studentDocId', String(data.studentDocId));
        localStorage.setItem('jaystar_cached_user_role', role.toLowerCase());
        localStorage.setItem('jaystar_cached_user_id', currentUser.uid);
        if (data.name) localStorage.setItem('jaystar_cached_user_name', String(data.name));

        if (data.forcePasswordReset === true && mounted) setMustResetPassword(true);
        if (mounted) setIsAuthorized(true);
      } catch (error) {
        console.error('Protected portal authorization failed:', error);
        if (mounted) setIsAuthorized(false);
      } finally {
        if (mounted) setLoading(false);
      }
    });
    return () => { mounted = false; unsubscribe(); };
  }, [rolesKey, location.pathname]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900"><Loader2 className="w-10 h-10 animate-spin text-brand-red" /></div>;

  if (!isAuthorized) {
    if (blockedMessage) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 p-6"><div className="max-w-md w-full rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 p-7 text-center shadow-xl"><div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center font-black text-lg">!</div><h1 className="text-xl font-black text-gray-900 dark:text-white">Account access restricted</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{blockedMessage}</p></div></div>;
    return <Navigate to={redirectPath} replace />;
  }

  return <>{mustResetPassword && <ChangePasswordModal isOpen={true} isForced={true} onSuccess={() => setMustResetPassword(false)} />}{children}</>;
};

export default ProtectedRoute;
