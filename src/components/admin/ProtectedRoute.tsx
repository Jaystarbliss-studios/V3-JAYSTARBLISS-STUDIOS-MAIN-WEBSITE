import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Loader2 } from 'lucide-react';
import ChangePasswordModal from '../portal/ChangePasswordModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  redirectPath = '/portal' 
}) => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const location = useLocation();

  // Create stable primitive key for allowedRoles array to prevent infinite re-renders on route transitions
  const rolesKey = allowedRoles ? allowedRoles.slice().sort().join(',') : '';

  // Pre-validate from persistent cache to eliminate screen flashing and reload dropouts
  const getCachedRole = () => {
    return (sessionStorage.getItem('userRole') || localStorage.getItem('jaystar_cached_user_role') || '').toUpperCase();
  };

  const getCachedUserId = () => {
    return sessionStorage.getItem('userId') || localStorage.getItem('jaystar_cached_user_id') || sessionStorage.getItem('studentDocId') || sessionStorage.getItem('schoolId') || '';
  };

  const isRoleMatching = (roleToCheck: string, key: string, path: string): boolean => {
    if (!roleToCheck) return false;
    const normalized = roleToCheck.toUpperCase();
    if (normalized.includes('ADMIN') || normalized === 'SUPER_ADMIN') return true;

    if (!key) {
      if (path.startsWith('/admin')) {
        return normalized.includes('ADMIN');
      }
      return true;
    }

    const roleList = key.split(',').filter(Boolean).map(r => r.toUpperCase());
    return roleList.some(allowed => {
      if (allowed === normalized) return true;
      if (allowed === 'STUDENT' && (normalized === 'INDIVIDUALSTUDENT' || normalized === 'STUDENT')) return true;
      if (allowed === 'STAFF' && (normalized === 'TUTOR' || normalized === 'STAFF')) return true;
      if (allowed === 'TUTOR' && (normalized === 'STAFF' || normalized === 'TUTOR')) return true;
      return false;
    });
  };

  useEffect(() => {
    let isMounted = true;

    // Check cached session immediately
    const cachedRole = getCachedRole();
    const cachedUid = getCachedUserId();
    if (cachedRole && cachedUid && isRoleMatching(cachedRole, rolesKey, location.pathname)) {
      if (isMounted) {
        setIsAuthorized(true);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;

      if (!currentUser) {
        // Check if there is an active session cache (e.g. Student with Access Code or Partner School)
        const currentCachedRole = getCachedRole();
        const currentCachedUid = getCachedUserId();
        
        if (currentCachedRole && currentCachedUid && isRoleMatching(currentCachedRole, rolesKey, location.pathname)) {
          if (isMounted) {
            setIsAuthorized(true);
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setIsAuthorized(false);
          setLoading(false);
        }
        return;
      }

      try {
        // 1. Check Super Admin by email
        if (currentUser.email === 'johnrufai242@gmail.com') {
          sessionStorage.setItem('userRole', 'super_admin');
          sessionStorage.setItem('userId', currentUser.uid);
          localStorage.setItem('jaystar_cached_user_role', 'super_admin');
          localStorage.setItem('jaystar_cached_user_id', currentUser.uid);
          if (isMounted) {
            setIsAuthorized(true);
            setLoading(false);
          }
          return;
        }

        let userRole = '';
        let userName = currentUser.displayName || '';
        let forceReset = false;

        // 2. Check users collection
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const uData = userDoc.data();
            const accountStatus = String(uData.accountStatus || 'ACTIVE').toUpperCase();
            if (accountStatus === 'SUSPENDED' || accountStatus === 'BANNED') {
              setBlockedReason(accountStatus === 'BANNED' ? 'Your account has been banned.' : 'Your account is temporarily suspended.');
              setIsAuthorized(false);
              setLoading(false);
              return;
            }
            userRole = (uData.role || '').toUpperCase();
            if (uData.name && !userName) userName = uData.name;
            if (uData.forcePasswordReset === true) forceReset = true;
          }
        } catch (e) {
          console.warn('User doc check error (fallback to cached role if present):', e);
        }

        // 3. Fallback: check individualStudents collection
        if (!userRole) {
          try {
            const studentQuery = query(
              collection(db, 'individualStudents'),
              where('firebaseUid', '==', currentUser.uid)
            );
            const studentSnap = await getDocs(studentQuery);
            if (!studentSnap.empty) {
              const sData = studentSnap.docs[0].data();
              userRole = 'STUDENT';
              sessionStorage.setItem('studentDocId', studentSnap.docs[0].id);
              if (sData.fullName) userName = sData.fullName;
              const accountStatus = String(sData.status || sData.accountStatus || 'ACTIVE').toUpperCase();
              if (accountStatus === 'SUSPENDED' || accountStatus === 'BANNED') {
                setBlockedReason(accountStatus === 'BANNED' ? 'Your account has been banned.' : 'Your account is temporarily suspended.');
                setIsAuthorized(false);
                setLoading(false);
                return;
              }
              if (sData.forcePasswordReset === true) forceReset = true;
            }
          } catch (e) {
            console.warn('Student check error:', e);
          }
        }

        // 4. Fallback: check parents collection
        if (!userRole) {
          try {
            const parentDoc = await getDoc(doc(db, 'parents', currentUser.uid));
            if (parentDoc.exists()) {
              const pData = parentDoc.data();
              userRole = 'PARENT';
              if (pData.name) userName = pData.name;
              if (pData.forcePasswordReset === true) forceReset = true;
            }
          } catch (e) {
            console.warn('Parent check error:', e);
          }
        }

        // 5. Fallback: check schools collection
        if (!userRole) {
          try {
            const schoolDoc = await getDoc(doc(db, 'schools', currentUser.uid));
            if (schoolDoc.exists()) {
              const scData = schoolDoc.data();
              userRole = 'SCHOOL';
              if (scData.name) userName = scData.name;
              if (scData.forcePasswordReset === true) forceReset = true;
            }
          } catch (e) {
            console.warn('School check error:', e);
          }
        }

        // 6. Fallback: check tutors collection
        if (!userRole) {
          try {
            const tutorDoc = await getDoc(doc(db, 'tutors', currentUser.uid));
            if (tutorDoc.exists()) {
              const tData = tutorDoc.data();
              userRole = 'TUTOR';
              if (tData.name) userName = tData.name;
              if (tData.forcePasswordReset === true) forceReset = true;
            }
          } catch (e) {
            console.warn('Tutor check error:', e);
          }
        }

        // Default to cached role if Firestore is still syncing
        if (!userRole) {
          userRole = (sessionStorage.getItem('userRole') || localStorage.getItem('jaystar_cached_user_role') || 'USER').toUpperCase();
        }

        const normalizedRole = userRole.toUpperCase();
        sessionStorage.setItem('userRole', normalizedRole.toLowerCase());
        sessionStorage.setItem('userId', currentUser.uid);
        localStorage.setItem('jaystar_cached_user_role', normalizedRole.toLowerCase());
        localStorage.setItem('jaystar_cached_user_id', currentUser.uid);
        if (userName) {
          sessionStorage.setItem('userName', userName);
          localStorage.setItem('jaystar_cached_user_name', userName);
        }

        // Check if forced password reset is triggered
        if (forceReset && isMounted) {
          setMustResetPassword(true);
        }

        const isAllowed = isRoleMatching(normalizedRole, rolesKey, location.pathname);
        if (isMounted) {
          setIsAuthorized(isAllowed);
        }
      } catch (error) {
        console.error("Error verifying user role in ProtectedRoute:", error);
        // Resilient fallback to cached role on network error
        const fallbackRole = getCachedRole();
        if (fallbackRole && isRoleMatching(fallbackRole, rolesKey, location.pathname)) {
          if (isMounted) setIsAuthorized(true);
        } else {
          if (isMounted) setIsAuthorized(false);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [rolesKey, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
      </div>
    );
  }

  if (blockedReason) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 p-8 text-center shadow-xl">
          <h1 className="text-xl font-black text-gray-900 dark:text-white mb-2">Account Access Restricted</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">{blockedReason}</p>
          <p className="text-xs text-gray-400 mt-4">Please contact Jaystarbliss support if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <>
      {mustResetPassword && (
        <ChangePasswordModal
          isOpen={true}
          isForced={true}
          onSuccess={() => setMustResetPassword(false)}
        />
      )}
      {children}
    </>
  );
};

export default ProtectedRoute;
