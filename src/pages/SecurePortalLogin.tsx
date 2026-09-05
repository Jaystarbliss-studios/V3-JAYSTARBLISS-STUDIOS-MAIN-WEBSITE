import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { School, GraduationCap, Users, ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowLeft, Sun, Moon } from 'lucide-react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useTheme } from '../hooks/useTheme';
import SEO from '../components/ui/SEO';
import { useToast } from '../contexts/ToastContext';
import { JaystarblissIcon } from '../components/common/JaystarblissLogo';
import CyberTerrainCanvas from '../components/portal/CyberTerrainCanvas';
import CyberLiquidButton from '../components/portal/CyberLiquidButton';
import ThreeOctagonLogo from '../components/portal/ThreeOctagonLogo';
import './Portal.css';

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
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Role>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const serverAccess = async (role: 'student' | 'school') => {
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
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) { await signOut(auth).catch(() => undefined); throw new Error('No active portal profile was found for this account. Please complete registration or contact an administrator.'); }
    const data = snap.data() || {};
    if (blocked(data)) { await signOut(auth).catch(() => undefined); throw new Error(`This account is ${String(data.accountStatus || data.status).toLowerCase()}. Please contact an administrator.`); }
    const role = String(data.role || '').toUpperCase();
    if (role.includes('ADMIN')) { storeSession('super_admin', user.uid, data.name || user.displayName || 'Admin', { userEmail: user.email || '' }); navigate('/admin'); return; }
    if (activeTab === 'parent' && role !== 'PARENT') throw new Error('This account is not registered as a parent.');
    if (activeTab === 'staff' && !['STAFF', 'TUTOR', 'INSTRUCTOR'].includes(role)) throw new Error('This account is not registered as teaching staff.');
    const sessionRole = role === 'TUTOR' || role === 'INSTRUCTOR' || role === 'STAFF' ? 'staff' : role.toLowerCase();
    const route = sessionRole === 'parent' ? '/portal/parent' : '/portal/staff';
    storeSession(sessionRole, user.uid, data.name || user.displayName || email.split('@')[0], { userEmail: user.email || '', schoolId: data.schoolId || '' });
    navigate(route);
  };

  const handleLogin = async (event?: React.FormEvent) => {
    event?.preventDefault(); setError(''); setLoading(true);
    try {
      if (!identifier.trim() || !password.trim()) throw new Error(activeTab === 'student' ? 'Enter your Student Username / Email and Access Code.' : activeTab === 'school' ? 'Enter your School Email / Terminal ID and Access Code.' : 'Enter your email and password.');
      if (activeTab === 'student' || activeTab === 'school') {
        const result = await serverAccess(activeTab);
        const name = result.data.name || identifier.trim();
        const sessionRole = result.data.role === 'school' ? 'school' : 'student';
        storeSession(sessionRole, result.user.uid, name, sessionRole === 'student' ? {
          studentDocId: result.data.studentDocId || '', studentUsername: result.data.username || '', studentClass: result.data.class || '', schoolId: result.data.schoolId || '', schoolName: result.data.schoolName || ''
        } : { schoolId: result.data.schoolId || result.data.schoolDocId || '' });
        toast.success(`Welcome ${String(name).split(' ')[0]}! Logged in successfully.`);
        navigate(sessionRole === 'school' ? '/portal/school' : '/portal/student');
      } else {
        await loginManagedAccount();
        toast.success('Signed in successfully.');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials and try again.');
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try {
      if (activeTab !== 'parent' && activeTab !== 'staff') throw new Error('Google sign-in is available for parent and staff accounts only.');
      const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      const user = result.user;
      const snap = await getDoc(doc(db, 'users', user.uid));
      let data = snap.exists() ? snap.data() || {} : null;
      if (!data) {
        if (activeTab !== 'parent') { await signOut(auth).catch(() => undefined); throw new Error('Staff accounts are created by administrators. Please contact an administrator.'); }
        data = { email: user.email || '', name: user.displayName || '', role: 'parent', createdAt: serverTimestamp() };
        await setDoc(doc(db, 'users', user.uid), data);
      }
      if (blocked(data)) { await signOut(auth).catch(() => undefined); throw new Error('This account is currently disabled. Please contact an administrator.'); }
      const role = String(data.role || '').toUpperCase();
      if (role !== 'PARENT' && !['STAFF', 'TUTOR', 'INSTRUCTOR'].includes(role)) { await signOut(auth).catch(() => undefined); throw new Error('This Google account is not enabled for this portal.'); }
      const sessionRole = role === 'PARENT' ? 'parent' : 'staff';
      storeSession(sessionRole, user.uid, data.name || user.displayName || 'Portal User', { userEmail: user.email || '', schoolId: data.schoolId || '' });
      navigate(`/portal/${sessionRole}`);
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed.');
    } finally { setLoading(false); }
  };

  const tabs: { id: Role; label: string; icon: React.ReactNode }[] = [
    { id: 'student', label: 'Students', icon: <GraduationCap size={16} /> },
    { id: 'school', label: 'Schools', icon: <School size={16} /> },
    { id: 'parent', label: 'Parents', icon: <Users size={16} /> },
    { id: 'staff', label: 'Staff', icon: <ShieldCheck size={16} /> },
  ];

  return <div className={`jdh-portal ${theme === 'dark' ? 'dark' : 'light'}`}><SEO title="Academy & Client Portal — Jaystarbliss Studios" description="Secure access to student dashboards, school portals, parent progress reports, and staff workspaces." /><div className="scanlines" />
    <div className="card">
      <div className="deco-panel relative"><CyberTerrainCanvas theme={theme} /><Link to="/" className="deco-brand flex items-center gap-3 select-none group" aria-label="Home"><JaystarblissIcon className="w-9 h-9 rounded-xl group-hover:scale-105 transition-transform shrink-0" /><span className="font-black text-base tracking-wider uppercase whitespace-nowrap">JAYSTARBLISS STUDIOS</span></Link><div className="deco-center-stage"><div className="stage-glow-reflection" /><ThreeOctagonLogo size={185} className="relative z-10" /></div><div className="deco-bottom"><div className="deco-tagline">Learn. <br/><span>Grow.</span> <br/>Thrive.</div></div></div>
      <div className="form-panel"><div className="role-tabs">{tabs.map(tab => <button key={tab.id} type="button" className={`role-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => { setActiveTab(tab.id); setIdentifier(''); setPassword(''); setError(''); }}>{tab.icon}<span>{tab.label}</span></button>)}</div>
        <div className="form-body"><div className="pane"><div className="form-title capitalize">{activeTab} <em>Portal Login</em></div><div className="form-sub">{activeTab === 'student' ? 'Use the Student Username / Email and Access Code issued by your tutor or school.' : activeTab === 'school' ? 'Use your School Email / Terminal ID and institutional access code.' : activeTab === 'parent' ? 'Sign in to monitor your children’s classes and progress.' : 'Sign in to your tutor and instructor workspace.'}</div>
          {error && <div className="msg msg-error show" role="alert">{error}</div>}
          <form onSubmit={handleLogin} autoComplete="on"><div className="field"><label>{activeTab === 'student' ? 'Student Username or Email' : activeTab === 'school' ? 'School Email or Terminal ID' : activeTab === 'parent' ? 'Parent Email Address' : 'Staff / Tutor Email'}</label><div className="input-wrap"><span className="input-icon"><Mail size={15}/></span><input type={activeTab === 'parent' || activeTab === 'staff' ? 'email' : 'text'} required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder={activeTab === 'student' ? 'e.g. john or john@example.com' : activeTab === 'school' ? 'school@institution.edu' : activeTab === 'parent' ? 'parent@example.com' : 'staff@jaystarbliss.ng'} /></div></div>
          <div className="field"><label>{activeTab === 'student' || activeTab === 'school' ? 'Access Code' : 'Password'}</label><div className="input-wrap"><span className="input-icon"><Lock size={15}/></span><input type={showPassword ? 'text' : 'password'} className="has-eye" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /><button type="button" className="pw-eye" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}</button></div></div>
          <div className="field" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'-0.5rem'}}><label htmlFor="rememberMe" style={{display:'flex',alignItems:'center',gap:'0.5rem',margin:0,fontSize:'0.85rem',fontWeight:'normal',textTransform:'none',letterSpacing:'normal'}}><input id="rememberMe" type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{width:'auto'}}/>Remember me</label>{(activeTab === 'staff' || activeTab === 'school') && <span className="text-xs" style={{color:'var(--text-dim)'}}>{activeTab === 'staff' ? 'Managed by administrators' : 'Institutional access'}</span>}</div>
          <CyberLiquidButton type="submit" loading={loading}>{activeTab === 'student' ? 'LAUNCH STUDENT HUB →' : 'INITIALIZE ACCESS →'}</CyberLiquidButton></form>
          {(activeTab === 'parent' || activeTab === 'staff') && <><div className="auth-divider">or</div><button type="button" className="google-btn" onClick={handleGoogle} disabled={loading}><span aria-hidden="true" style={{fontWeight:900,fontSize:18}}>G</span><span className="btn-text">Continue with Google</span></button></>}
          <div className="toggle-link">Don't have an account yet? <Link to="/register">Register / Enroll Here →</Link></div>
        </div></div>
        <div className="form-foot"><Link to="/" className="back-link"><ArrowLeft size={14}/> Main Site</Link><div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}><span style={{fontFamily:'var(--mono)',fontSize:'0.55rem',color:'var(--dim)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Secure Portal</span><button type="button" className="theme-btn" onClick={toggleTheme} title="Toggle theme">{theme === 'dark' ? <Moon size={14}/> : <Sun size={14}/>}</button></div></div>
      </div>
    </div>
  </div>;
};

export default SecurePortalLogin;
