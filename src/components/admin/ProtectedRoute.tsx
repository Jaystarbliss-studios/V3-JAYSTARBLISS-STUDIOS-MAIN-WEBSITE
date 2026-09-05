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
const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'CONTENT_ADMIN', 'EDUCATION_ADMIN', 'SERVICES_ADMIN', 'MARKETING_ADMIN', 'SUPPORT_ADMIN'];

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
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userSnap.exists()) {
          await signOut(auth).catch(() => undefined);
          throw new Error('Authenticated user has no authoritative portal profile.');
        }

        const data = userSnap.data() || {};
        const accountStatus = String(data.accountStatus || data.status || 'ACTIVE').toUpperCase();
        if (blockedStatuses.includes(accountStatus.toLowerCase())) {
          if (mounted) setBlockedMessage(`Your account is currently ${accountStatus.toLowerCase()}. Please contact Jaystarbliss Studios support.`);
          await signOut(auth).catch(() => undefined);
          return;
        }

        const role = String(data.role || '').trim().toUpperCase();
        if (!role) {
          await signOut(auth).catch(() => undefined);
          throw new Error('Authenticated user has no authoritative portal role.');
        }

        const allowed = allowedRoles?.length
          ? allowedRoles.some(candidate => candidate.toUpperCase() === role)
          : location.pathname.startsWith('/admin')
            ? adminRoles.includes(role)
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
