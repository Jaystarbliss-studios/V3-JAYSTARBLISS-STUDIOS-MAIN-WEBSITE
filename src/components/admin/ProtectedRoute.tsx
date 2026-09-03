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
  const location = useLocation();

  // Create stable primitive key for allowedRoles array to prevent infinite re-renders on route transitions
  const rolesKey = allowedRoles ? allowedRoles.slice().sort().join(',') : '';

  const isRoleMatching = (role: string, key: string, pathname: string) => {
    const roles = key ? key.split(',').filter(Boolean).map(r => r.toUpperCase()) : [];
    if (roles.length > 0) return roles.includes(role.toUpperCase());

    // Routes without an explicit role list are authenticated-user routes.
    // Admin routes still require an administrator role.
    if (pathname.startsWith('/admin')) {
      return ['SUPER_ADMIN', 'ADMIN', 'CONTENT_ADMIN', 'EDUCATION_ADMIN', 'SERVICES_ADMIN', 'MARKETING_ADMIN', 'SUPPORT_ADMIN'].includes(role.toUpperCase());
    }
    return true;
  };

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;

      if (!currentUser) {
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
            userRole = (uData.role || '').toUpperCase();
            if (uData.name && !userName) userName = uData.name;
            if (uData.forcePasswordReset === true) forceReset = true;
          }
        } catch (e) {
          console.warn('User doc check error:', e);
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

        // Never authorize from a client-side cached role. If the authoritative
        // identity records are unavailable, fail closed instead.
        if (!userRole) {
          throw new Error('Authenticated user has no authoritative portal role');
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
        // Fail closed. A stale client-side role cache must never grant access
        // when the authoritative Firestore role cannot be verified.
        if (isMounted) setIsAuthorized(false);
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
