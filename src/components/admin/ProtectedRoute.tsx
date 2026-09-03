import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const location = useLocation();

  const rolesKey = allowedRoles ? allowedRoles.slice().sort().join(',') : '';

  const isRoleMatching = (role: string, key: string, pathname: string) => {
    const roles = key ? key.split(',').filter(Boolean).map(r => r.toUpperCase()) : [];
    if (roles.length > 0) return roles.includes(role.toUpperCase());

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
        setIsAuthorized(false);
        setBlockedMessage(null);
        setLoading(false);
        return;
      }

      try {
        // 1. Check the authoritative Firestore user profile first, including status.
        // Firebase's client-side User type does not expose Admin SDK's `disabled` field;
        // authoritative account disabling is enforced through the users/profile records
        // and the server-side portal access endpoint.
        let userRole = '';
        let userName = currentUser.displayName || '';
        let forceReset = false;

        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const uData = userDoc.data();
            const accountStatus = String(uData.accountStatus || uData.status || 'active').toLowerCase();
            if (['banned', 'suspended', 'disabled'].includes(accountStatus)) {
              const label = accountStatus === 'banned' ? 'banned' : accountStatus === 'suspended' ? 'suspended' : 'disabled';
              if (isMounted) {
                setBlockedMessage(`Your account is currently ${label}. Please contact Jaystarbliss Studios support.`);
                setIsAuthorized(false);
              }
              await signOut(auth);
              return;
            }
            userRole = (uData.role || '').toUpperCase();
            if (uData.name && !userName) userName = uData.name;
            if (uData.forcePasswordReset === true) forceReset = true;
          }
        } catch (e) {
          console.warn('User doc check error:', e);
        }

        // 2. A super admin identity is still checked after account-state enforcement.
        if (!userRole && currentUser.email === 'johnrufai242@gmail.com') {
          userRole = 'SUPER_ADMIN';
        }

        // 3. Check individualStudents collection.
        if (!userRole) {
          try {
            const studentQuery = query(
              collection(db, 'individualStudents'),
              where('firebaseUid', '==', currentUser.uid)
            );
            const studentSnap = await getDocs(studentQuery);
            if (!studentSnap.empty) {
              const sData = studentSnap.docs[0].data();
              const accountStatus = String(sData.accountStatus || sData.status || 'active').toLowerCase();
              if (['banned', 'suspended', 'disabled'].includes(accountStatus)) {
                if (isMounted) {
                  setBlockedMessage(`Your student account is currently ${accountStatus}. Please contact Jaystarbliss Studios support.`);
                  setIsAuthorized(false);
                }
                await signOut(auth);
                return;
              }
              userRole = 'STUDENT';
              sessionStorage.setItem('studentDocId', studentSnap.docs[0].id);
              if (sData.fullName) userName = sData.fullName;
              if (sData.forcePasswordReset === true) forceReset = true;
            }
          } catch (e) {
            console.warn('Student check error:', e);
          }
        }

        // 4. Check parents collection.
        if (!userRole) {
          try {
            const parentDoc = await getDoc(doc(db, 'parents', currentUser.uid));
            if (parentDoc.exists()) {
              const pData = parentDoc.data();
              const accountStatus = String(pData.accountStatus || pData.status || 'active').toLowerCase();
              if (['banned', 'suspended', 'disabled'].includes(accountStatus)) {
                if (isMounted) {
                  setBlockedMessage(`Your parent account is currently ${accountStatus}. Please contact Jaystarbliss Studios support.`);
                  setIsAuthorized(false);
                }
                await signOut(auth);
                return;
              }
              userRole = 'PARENT';
              if (pData.name) userName = pData.name;
              if (pData.forcePasswordReset === true) forceReset = true;
            }
          } catch (e) {
            console.warn('Parent check error:', e);
          }
        }

        // 5. Check schools collection.
        if (!userRole) {
          try {
            const schoolDoc = await getDoc(doc(db, 'schools', currentUser.uid));
            if (schoolDoc.exists()) {
              const scData = schoolDoc.data();
              const accountStatus = String(scData.accountStatus || scData.status || 'active').toLowerCase();
              if (['banned', 'suspended', 'disabled'].includes(accountStatus)) {
                if (isMounted) {
                  setBlockedMessage(`Your school account is currently ${accountStatus}. Please contact Jaystarbliss Studios support.`);
                  setIsAuthorized(false);
                }
                await signOut(auth);
                return;
              }
              userRole = 'SCHOOL';
              if (scData.name) userName = scData.name;
              if (scData.forcePasswordReset === true) forceReset = true;
            }
          } catch (e) {
            console.warn('School check error:', e);
          }
        }

        // 6. Check tutors collection.
        if (!userRole) {
          try {
            const tutorDoc = await getDoc(doc(db, 'tutors', currentUser.uid));
            if (tutorDoc.exists()) {
              const tData = tutorDoc.data();
              const accountStatus = String(tData.accountStatus || tData.status || 'active').toLowerCase();
              if (['banned', 'suspended', 'disabled'].includes(accountStatus)) {
                if (isMounted) {
                  setBlockedMessage(`Your staff account is currently ${accountStatus}. Please contact Jaystarbliss Studios support.`);
                  setIsAuthorized(false);
                }
                await signOut(auth);
                return;
              }
              userRole = 'TUTOR';
              if (tData.name) userName = tData.name;
              if (tData.forcePasswordReset === true) forceReset = true;
            }
          } catch (e) {
            console.warn('Tutor check error:', e);
          }
        }

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

        if (forceReset && isMounted) {
          setMustResetPassword(true);
        }

        const isAllowed = isRoleMatching(normalizedRole, rolesKey, location.pathname);
        if (isMounted) setIsAuthorized(isAllowed);
      } catch (error) {
        console.error("Error verifying user role in ProtectedRoute:", error);
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
    if (blockedMessage) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 p-6">
          <div className="max-w-md w-full rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 p-7 text-center shadow-xl">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center">
              <span className="font-black text-lg">!</span>
            </div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">Account access restricted</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{blockedMessage}</p>
          </div>
        </div>
      );
    }
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
