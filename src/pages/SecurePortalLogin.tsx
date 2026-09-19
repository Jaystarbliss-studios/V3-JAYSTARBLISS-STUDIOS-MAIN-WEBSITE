import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { School, GraduationCap, Users, ShieldCheck, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useTheme } from '../hooks/useTheme';
import SEO from '../components/ui/SEO';
import { useToast } from '../contexts/ToastContext';
import { JaystarblissIcon } from '../components/common/JaystarblissLogo';
import portalWallpaper from '../assets/jdi login bg.png';
import './Portal.css';
import './SecurePortalTheme.css';

type Role = 'school' | 'student' | 'parent' | 'staff';
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const blocked = (data: Record<string, any>) => ['DISABLED', 'SUSPENDED', 'BANNED'].includes(String(data.accountStatus || data.status || 'ACTIVE').toUpperCase());

const storeSession = (role: string, uid: string, name: string, extras: Record<string, string> = {}) => {
  sessionStorage.setItem('userRole', role); sessionStorage.setItem('userId', uid); sessionStorage.setItem('userName', name);
  Object.entries(extras).forEach(([key, value]) => sessionStorage.setItem(key, value || ''));
  localStorage.setItem('jaystar_cached_user_role', role); localStorage.setItem('jaystar_cached_user_id', uid); localStorage.setItem('jaystar_cached_user_name', name);
};

const SecurePortalLogin: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Role>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const serverAccess = async (role: 'student') => {
    const response = await fetch('/.netlify/functions/portal-access-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, identifier: identifier.trim(), code: password.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.customToken) throw new Error(data.error || 'Invalid portal credentials.');
    const credential = await signInWithCustomToken(auth, data.customToken);
    return { data, user: credential.user };
  };

  const loginManagedAccount = async () => {
    const email = identifier.trim().toLowerCase();
    if (!email || !password) throw new Error('Enter your email and password.');
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    let snap = await getDoc(doc(db, 'users', user.uid));
    let data = snap.exists() ? (snap.data() || {}) : {};

    // If logging into the school portal tab, run the trusted server-side self-heal if profile or link is missing
    if (activeTab === 'school' && (!snap.exists() || !data.schoolId || String(data.role || '').toUpperCase() !== 'SCHOOL')) {
      try {
        const idToken = await user.getIdToken(true);
        const response = await fetch('/.netlify/functions/admin-school-admin-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ scope: 'single', email: user.email || email }),
        });
        const syncData = await response.json().catch(() => ({}));
        if (response.ok && syncData?.results?.[0]?.status === 'LINKED') {
          const refreshedSnap = await getDoc(doc(db, 'users', user.uid));
          if (refreshedSnap.exists()) {
            snap = refreshedSnap;
            data = refreshedSnap.data() || {};
          }
        }
      } catch (err) {
        console.warn('School admin self-heal check:', err);
      }
    }

    if (!snap.exists()) { 
      await signOut(auth).catch(() => undefined); 
      throw new Error('No active portal profile was found for this account. Please complete registration or contact an administrator.'); 
    }
    if (blocked(data)) { 
      await signOut(auth).catch(() => undefined); 
      throw new Error(`This account is ${String(data.accountStatus || data.status).toLowerCase()}. Please contact an administrator.`); 
    }
    const role = String(data.role || '').toUpperCase();
    if (role.includes('ADMIN')) { 
      storeSession('super_admin', user.uid, data.name || user.displayName || 'Admin', { userEmail: user.email || '' }); 
      navigate('/admin'); 
      return; 
    }

    if (activeTab === 'parent' && role !== 'PARENT') {
      await signOut(auth).catch(() => undefined);
      throw new Error('This account is not registered as a parent.');
    }
    if (activeTab === 'staff' && !['STAFF', 'TUTOR', 'INSTRUCTOR'].includes(role)) {
      await signOut(auth).catch(() => undefined);
      throw new Error('This account is not registered as teaching staff.');
    }
    if (activeTab === 'school') {
      if (role !== 'SCHOOL') {
        await signOut(auth).catch(() => undefined);
        throw new Error('This account is not registered as an affiliated school administrator.');
      }
      if (!data.schoolId) {
        const idToken = await user.getIdToken(true);
        const response = await fetch('/.netlify/functions/admin-school-admin-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ scope: 'single', email: user.email || email }),
        });
        const syncData = await response.json().catch(() => ({}));
        if (response.ok && syncData?.results?.[0]?.status === 'LINKED') {
          const refreshedSnap = await getDoc(doc(db, 'users', user.uid));
          if (refreshedSnap.exists()) {
            data = refreshedSnap.data() || {};
          }
        }
        if (!data.schoolId) {
          await signOut(auth).catch(() => undefined);
          throw new Error('Your school administrator account is not linked to an active school record yet. Please contact an administrator.');
        }
      }
    }

    const sessionRole = role === 'TUTOR' || role === 'INSTRUCTOR' || role === 'STAFF' 
      ? 'staff' 
      : role === 'SCHOOL' 
        ? 'school' 
        : role.toLowerCase();
    const route = sessionRole === 'parent' 
      ? '/portal/parent' 
      : sessionRole === 'school' 
        ? '/portal/school' 
        : '/portal/staff';
    
    storeSession(sessionRole, user.uid, data.name || data.schoolName || user.displayName || email.split('@')[0], { 
      userEmail: user.email || '', 
      schoolId: data.schoolId || '',
      schoolName: data.schoolName || ''
    });
    navigate(route);
  };

  const handleLogin = async (event?: React.FormEvent) => {
    event?.preventDefault(); setError(''); setLoading(true);
    try {
      if (!identifier.trim() || !password.trim()) {
        throw new Error(
          activeTab === 'student' 
            ? 'Enter your Student Username / Email and Access Code.' 
            : activeTab === 'school' 
              ? 'Enter your School Administrator Email and Password.' 
              : 'Enter your email and password.'
        );
      }
      if (activeTab === 'student') {
        const result = await serverAccess('student');
        const name = result.data.name || identifier.trim();
        storeSession('student', result.user.uid, name, {
          studentDocId: result.data.studentDocId || '',
          studentUsername: result.data.username || '',
          studentClass: result.data.class || '',
          schoolId: result.data.schoolId || '',
          schoolName: result.data.schoolName || ''
        });
        toast.success(`Welcome ${String(name).split(' ')[0]}! Logged in successfully.`);
        navigate('/portal/student');
      } else {
        await loginManagedAccount();
        toast.success('Signed in successfully.');
      }
    } catch (err: any) {
      const code = String(err?.code || '');
      setError(code === 'auth/invalid-credential' ? 'The email or password is incorrect. If you no longer know the password, use “Forgot password?” below to reset it.' : err?.message || 'Login failed. Please check your credentials and try again.');
    } finally { setLoading(false); }
  };

  const handlePasswordReset = async () => {
    const email = identifier.trim().toLowerCase();
    if (!email) { setError('Enter your email address first, then select “Forgot password?”.'); return; }
    setError(''); setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('If an account exists for that email, a password reset link has been sent.');
      setError('Check your email for the password reset link.');
    } catch (err: any) {
      setError(err?.message || 'Unable to start password recovery. Please try again.');
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try {
      if (activeTab !== 'parent' && activeTab !== 'staff') throw new Error('Google sign-in is available for parent and staff accounts only.');
      const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      const googleUser = result.user;
      const snap = await getDoc(doc(db, 'users', googleUser.uid));
      const existing = snap.exists() ? snap.data() || {} : {};
      const existingRole = String(existing.role || '').toUpperCase();

      if (activeTab === 'staff' && !['STAFF', 'TUTOR', 'INSTRUCTOR'].includes(existingRole)) {
        const idToken = await googleUser.getIdToken(true);
        const response = await fetch('/.netlify/functions/admin-google-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        const adminData = await response.json().catch(() => ({}));
        if (response.ok && adminData.customToken) {
          const credential = await signInWithCustomToken(auth, adminData.customToken);
          const adminSnap = await getDoc(doc(db, 'users', credential.user.uid));
          const adminProfile = adminSnap.exists() ? adminSnap.data() || {} : {};
          const adminRole = String(adminProfile.role || adminData.role || '').toUpperCase();
          if (!adminRole.includes('ADMIN')) { await signOut(auth).catch(() => undefined); throw new Error('Administrator profile verification failed.'); }
          storeSession('super_admin', credential.user.uid, adminProfile.name || adminData.name || credential.user.displayName || 'Admin', { userEmail: credential.user.email || adminData.email || '' });
          navigate('/admin');
          return;
        }
      }

      let data = snap.exists() ? snap.data() || {} : null;
      if (!data) {
        if (activeTab !== 'parent') { await signOut(auth).catch(() => undefined); throw new Error('Staff accounts are created by administrators. Please contact an administrator.'); }
        data = { email: googleUser.email || '', name: googleUser.displayName || '', role: 'parent', createdAt: serverTimestamp() };
        await setDoc(doc(db, 'users', googleUser.uid), data);
      }
      if (blocked(data)) { await signOut(auth).catch(() => undefined); throw new Error('This account is currently disabled. Please contact an administrator.'); }
      const role = String(data.role || '').toUpperCase();
      if (role.includes('ADMIN')) {
        storeSession('super_admin', googleUser.uid, data.name || googleUser.displayName || 'Admin', { userEmail: googleUser.email || '' });
        navigate('/admin');
        return;
      }
      if (role !== 'PARENT' && !['STAFF', 'TUTOR', 'INSTRUCTOR'].includes(role)) { await signOut(auth).catch(() => undefined); throw new Error('This Google account is not enabled for this portal.'); }
      const sessionRole = role === 'PARENT' ? 'parent' : 'staff';
      storeSession(sessionRole, googleUser.uid, data.name || googleUser.displayName || 'Portal User', { userEmail: googleUser.email || '', schoolId: data.schoolId || '' });
      navigate(`/portal/${sessionRole}`);
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed.');
    } finally { setLoading(false); }
  };

  const tabs: { id: Role; label: string; icon: React.ReactNode }[] = [
    { id: 'student', label: 'Students', icon: <GraduationCap size={13} /> },
    { id: 'school', label: 'Schools', icon: <School size={13} /> },
    { id: 'parent', label: 'Parents', icon: <Users size={13} /> },
    { id: 'staff', label: 'Staff', icon: <ShieldCheck size={13} /> },
  ];

  return (
    <div className={`jdh-portal ${theme === 'dark' ? 'dark' : 'light'}`}>
      <div className="jdh-portal-bg-viewport" aria-hidden="true">
        <img src={portalWallpaper} alt="" />
        <div className="bg-overlay" />
      </div>
      <SEO title="Academy & Client Portal — Jaystarbliss Studios" description="Secure access to student dashboards, school portals, parent progress reports, and staff workspaces." />
      <div className="scanlines" />

      <div className="card glass-modal-card">
        {/* TOP BRAND HEADER */}
        <div className="glass-header text-center pt-1 pb-2">
          <div className="flex items-center justify-center gap-2.5">
            <Link to="/" className="inline-flex items-center select-none group shrink-0" aria-label="Home">
              <JaystarblissIcon className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg group-hover:scale-105 transition-transform drop-shadow-md" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight drop-shadow-md m-0">
              Welcome Back
            </h1>
          </div>
        </div>

        {/* ROLE TABS */}
        <div className="glass-role-tabs mb-3.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`glass-role-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setIdentifier('');
                setPassword('');
                setError('');
              }}
            >
              {tab.icon}
              <span className="text-[10px]">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="msg msg-error show mb-3 text-xs py-2 px-3" role="alert">
            {error}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleLogin} autoComplete="on" className="space-y-3">
          <div className="field mb-2.5">
            <label className="text-[11px] font-bold text-white uppercase tracking-wider block mb-1 drop-shadow">
              {activeTab === 'student' 
                ? 'Student Username or Email' 
                : activeTab === 'school' 
                  ? 'School Administrator Email' 
                  : activeTab === 'parent' 
                    ? 'Email Address' 
                    : 'Staff / Admin Email'}
            </label>
            <div className="input-wrap relative">
              <span className="input-icon">
                <Mail size={14} />
              </span>
              <input
                type={activeTab === 'student' ? 'text' : 'email'}
                required
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder={
                  activeTab === 'student' 
                    ? 'example@gmail.com or username' 
                    : activeTab === 'school' 
                      ? 'peniellilystudent@gmail.com' 
                      : activeTab === 'parent' 
                        ? 'parent@example.com' 
                        : 'staff@jaystarbliss.ng'
                }
                className="glass-input"
              />
            </div>
          </div>

          <div className="field mb-2.5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-white uppercase tracking-wider block m-0 drop-shadow">
                {activeTab === 'student' ? 'Access Code' : 'Password'}
              </label>
              {(activeTab === 'school' || activeTab === 'parent' || activeTab === 'staff') && (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={loading}
                  className="text-[11px] font-semibold text-sky-200 hover:text-white transition-colors bg-transparent border-0 p-0 cursor-pointer drop-shadow"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="input-wrap relative">
              <span className="input-icon">
                <Lock size={14} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="glass-input has-eye"
              />
              <button
                type="button"
                className="pw-eye"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5 pb-0.5">
            <label htmlFor="rememberMe" className="flex items-center gap-1.5 text-[11px] font-medium text-white cursor-pointer select-none drop-shadow">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="rounded bg-white/10 border-white/40 text-sky-500 focus:ring-0 focus:ring-offset-0"
              />
              Remember me
            </label>
            {(activeTab === 'staff' || activeTab === 'school') && (
              <span className="text-[10px] text-slate-200 drop-shadow">
                {activeTab === 'staff' ? 'Admin managed' : 'Institutional'}
              </span>
            )}
          </div>

          {/* PRIMARY LOGIN BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="glass-submit-btn w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-white text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-200"
          >
            {loading ? (
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>

        {/* GOOGLE SIGN IN (PARENT / STAFF) */}
        {(activeTab === 'parent' || activeTab === 'staff') && (
          <>
            <div className="auth-divider my-2.5 text-xs text-slate-200">or</div>
            <button
              type="button"
              className="google-btn w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white font-medium text-xs transition-all bg-white/5 border border-white/20 hover:bg-white/15"
              onClick={handleGoogle}
              disabled={loading}
            >
              <span aria-hidden="true" className="font-black text-sm">G</span>
              <span>Continue with Google</span>
            </button>
          </>
        )}

        {/* BOTTOM REGISTER LINK */}
        <div className="text-center pt-3 pb-1 text-xs text-slate-200 drop-shadow">
          Are You New Member?{' '}
          <Link to="/register" className="text-white font-bold hover:underline transition-all ml-1">
            Sign UP
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SecurePortalLogin;
