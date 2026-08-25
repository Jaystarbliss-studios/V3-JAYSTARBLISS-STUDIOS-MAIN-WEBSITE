/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useToast } from './ToastContext';
import SessionExpirationModal from '../components/common/SessionExpirationModal';

// Configurable constants
const DEFAULT_TOTAL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of total idle time
const WARNING_THRESHOLD_MS = 2 * 60 * 1000;     // 2 minutes warning countdown (120 seconds)
const THROTTLE_ACTIVITY_MS = 3 * 1000;          // Throttle event listener updates to once every 3s
const STORAGE_KEY = 'jaystar_last_session_activity';

const isProtectedPath = () => {
  const path = window.location.pathname;
  const isProtectedPortal = path.startsWith('/portal/') && path !== '/portal';
  const isProtectedAdmin = path.startsWith('/admin');
  return isProtectedPortal || isProtectedAdmin;
};

interface SessionTimeoutContextType {
  extendSession: () => void;
  performLogout: (reason?: string) => Promise<void>;
  isWarningOpen: boolean;
  secondsRemaining: number;
  isAuthenticated: boolean;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | undefined>(undefined);

export const SessionTimeoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSessionAuthenticated, setIsSessionAuthenticated] = useState<boolean>(false);
  const [isWarningOpen, setIsWarningOpen] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);

  const isWarningOpenRef = useRef<boolean>(false);
  const isSessionAuthRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);

  // Sync ref with state
  useEffect(() => {
    isWarningOpenRef.current = isWarningOpen;
  }, [isWarningOpen]);

  useEffect(() => {
    isSessionAuthRef.current = isSessionAuthenticated;
  }, [isSessionAuthenticated]);

  // Determine user display metadata
  const userRole = sessionStorage.getItem('userRole') || (currentUser?.email === 'johnrufai242@gmail.com' ? 'Super Admin' : undefined);
  const userName = sessionStorage.getItem('userName') || currentUser?.displayName || currentUser?.email?.split('@')[0] || undefined;

  // Track Firebase Auth + Custom Session Storage authentication
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      const hasSessionAuth = !!(user || sessionStorage.getItem('userId') || sessionStorage.getItem('studentDocId'));
      setIsSessionAuthenticated(hasSessionAuth);
      isSessionAuthRef.current = hasSessionAuth;
      if (hasSessionAuth) {
        lastActivityRef.current = Date.now();
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
    });

    // Also check on mount / route transitions if sessionStorage has an active cadet/school session
    const hasSessionAuth = !!(auth.currentUser || sessionStorage.getItem('userId') || sessionStorage.getItem('studentDocId'));
    setIsSessionAuthenticated(hasSessionAuth);
    isSessionAuthRef.current = hasSessionAuth;
    if (hasSessionAuth) {
      lastActivityRef.current = Date.now();
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }

    return () => unsub();
  }, []);

  // Perform Graceful Logout
  const performLogout = useCallback(async (reason: string = 'manual') => {
    if (isLoggingOutRef.current) return;
    
    // If it's an inactivity timeout but we are on a login or public page, do not trigger a redirect loop
    if (reason === 'inactivity' && !isProtectedPath()) {
      setIsWarningOpen(false);
      isWarningOpenRef.current = false;
      return;
    }

    isLoggingOutRef.current = true;
    setIsWarningOpen(false);
    isWarningOpenRef.current = false;

    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase sign out notice:', e);
    }
    
    // Clear session and activity tracking
    sessionStorage.clear();
    localStorage.removeItem(STORAGE_KEY);
    setIsSessionAuthenticated(false);
    isSessionAuthRef.current = false;
    setCurrentUser(null);

    if (reason === 'inactivity') {
      toast.info('Your session expired due to inactivity. Please sign in again.');
    } else {
      toast.info('You have been signed out.');
    }

    // Redirect to main portal login
    window.location.href = '/portal';

    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 1000);
  }, [toast]);

  // Extend Session explicitly
  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Ignore storage errors in private browsing
    }
    setIsWarningOpen(false);
    isWarningOpenRef.current = false;
    setSecondsRemaining(120);
    toast.success('Your session has been extended.');
  }, [toast]);

  // Record user interaction (only auto-resets when warning modal is NOT active)
  const recordActivity = useCallback(() => {
    if (!isSessionAuthRef.current || isLoggingOutRef.current) return;
    
    const now = Date.now();
    // Throttle checks to avoid frequent updates
    if (now - lastThrottleRef.current < THROTTLE_ACTIVITY_MS) return;
    lastThrottleRef.current = now;

    // If warning modal is NOT open, quietly keep extending activity timestamp
    if (!isWarningOpenRef.current) {
      lastActivityRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // Ignore
      }
    }
  }, []);

  // Attach global DOM listeners for user activity
  useEffect(() => {
    if (!isSessionAuthenticated) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click', 'input', 'focus'];
    const handleActivity = () => recordActivity();

    events.forEach(evt => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });

    // Multi-tab synchronization: if another tab updates last activity, sync here
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime) && remoteTime > lastActivityRef.current) {
          lastActivityRef.current = remoteTime;
          setIsWarningOpen(false);
          isWarningOpenRef.current = false;
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, handleActivity);
      });
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isSessionAuthenticated, recordActivity]);

  // Core Timer Interval Loop (checks every 1 second)
  useEffect(() => {
    if (!isSessionAuthenticated) {
      if (isWarningOpenRef.current) {
        setIsWarningOpen(false);
        isWarningOpenRef.current = false;
      }
      return;
    }

    const interval = setInterval(() => {
      if (!isProtectedPath()) {
        if (isWarningOpenRef.current) {
          setIsWarningOpen(false);
          isWarningOpenRef.current = false;
        }
        return;
      }

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const timeLeft = DEFAULT_TOTAL_TIMEOUT_MS - elapsed;

      if (timeLeft <= 0) {
        // Auto-logout when total time is exhausted
        clearInterval(interval);
        performLogout('inactivity');
      } else if (timeLeft <= WARNING_THRESHOLD_MS) {
        // Inside 2-minute warning window
        if (!isWarningOpenRef.current) {
          setIsWarningOpen(true);
          isWarningOpenRef.current = true;
        }
        setSecondsRemaining(Math.max(0, Math.ceil(timeLeft / 1000)));
      } else {
        // Plenty of time remaining
        if (isWarningOpenRef.current) {
          setIsWarningOpen(false);
          isWarningOpenRef.current = false;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionAuthenticated, performLogout]);

  const contextValue = React.useMemo(() => ({
    extendSession,
    performLogout,
    isWarningOpen,
    secondsRemaining,
    isAuthenticated: isSessionAuthenticated
  }), [extendSession, performLogout, isWarningOpen, secondsRemaining, isSessionAuthenticated]);

  return (
    <SessionTimeoutContext.Provider value={contextValue}>
      {children}

      {/* Graceful Session Expiration Warning Modal */}
      <SessionExpirationModal
        isOpen={isWarningOpen && isSessionAuthenticated}
        secondsRemaining={secondsRemaining}
        totalWarningSeconds={120}
        onExtend={extendSession}
        onLogout={() => performLogout('manual')}
        userRole={userRole}
        userName={userName}
      />
    </SessionTimeoutContext.Provider>
  );
};

export const useSessionTimeout = () => {
  const context = useContext(SessionTimeoutContext);
  if (!context) {
    throw new Error('useSessionTimeout must be used within a SessionTimeoutProvider');
  }
  return context;
};

export default SessionTimeoutProvider;
