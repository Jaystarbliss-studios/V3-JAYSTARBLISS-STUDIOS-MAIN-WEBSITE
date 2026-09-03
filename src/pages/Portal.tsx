import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  School, GraduationCap, Users, ShieldCheck, Mail, Lock, 
  Eye, EyeOff, ArrowLeft, Sun, Moon, KeyRound, UserCheck
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  signInWithCustomToken,
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { 
  doc, getDoc, setDoc, serverTimestamp, deleteDoc 
} from 'firebase/firestore';
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

const STAFF_REG_CODE_FALLBACK = 'JAYSTAR2024';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function studentAuthEmail(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, '') + '@jdh-student.local';
}

function deriveStudentAuthPassword(code: string): string {
  // Firebase Auth requires passwords >= 6 characters.
  // Deterministically expand short student PINs/codes to maintain valid auth sessions.
  if (code.length >= 6) return code;
  return `jdh_std_${code}_2024`;
}

function deriveSchoolAuthPassword(code: string): string {
  if (code.length >= 6) return code;
  return `jdh_sch_${code}_2024`;
}

const recordPortalLogin = async (_role: string) => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await fetch('/.netlify/functions/log-activity', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'login' })
    });
  } catch (error) {
    // Telemetry must never prevent a successful login.
    console.warn('Login telemetry could not be recorded:', error);
  }
};

const Portal: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<Role>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState(''); // username, email, or school code
  const [password, setPassword] = useState('');     // password or access code
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Staff registration toggle
  const [showStaffReg, setShowStaffReg] = useState(false);
  const [staffRegCode, setStaffRegCode] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPw, setStaffPw] = useState('');

  const handleStudentLogin = async () => {
    const rawInput = identifier.trim();
    const code = password.trim();
    if (!rawInput || !code) throw new Error('Please enter both your Student Username / Email and Access Code.');

    const isRealEmail = rawInput.includes('@') && !rawInput.endsWith('.local');

    // Existing email/password accounts continue to use Firebase Auth directly.
    if (isRealEmail) {
      try {
        const cred = await signInWithEmailAndPassword(auth, rawInput.toLowerCase(), code);
        const user = cred.user;
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.data() || {};

        if (user.email === 'johnrufai242@gmail.com' || (userData.role || '').toUpperCase().includes('ADMIN')) {
          sessionStorage.setItem('userRole', 'super_admin');
          sessionStorage.setItem('userId', user.uid);
          sessionStorage.setItem('userEmail', user.email || '');
          await recordPortalLogin('ADMIN');
          navigate('/admin');
          return;
        }

        const studentDocId = userData.studentDocId || user.uid;
        const studentName = userData.name || user.displayName || rawInput.split('@')[0];
        sessionStorage.setItem('userRole', 'student');
        sessionStorage.setItem('userId', user.uid);
        sessionStorage.setItem('studentDocId', studentDocId);
        sessionStorage.setItem('userName', studentName);
        sessionStorage.setItem('userEmail', user.email || '');
        sessionStorage.setItem('schoolId', userData.schoolId || '');
        sessionStorage.setItem('schoolName', userData.schoolName || '');
        await recordPortalLogin('STUDENT');
        navigate('/portal/student');
        return;
      } catch (directAuthErr: any) {
        console.warn('Direct student email auth notice:', directAuthErr?.code);
      }
    }

    const response = await fetch('/.netlify/functions/portal-access-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'student', identifier: rawInput, code })
    });
    const data = await response.json();
    if (!response.ok || !data.customToken) {
      throw new Error(data.error || 'Invalid student credentials.');
    }

    const cred = await signInWithCustomToken(auth, data.customToken);
    sessionStorage.setItem('userRole', 'student');
    sessionStorage.setItem('userId', cred.user.uid);
    sessionStorage.setItem('studentDocId', data.studentDocId || cred.user.uid);
    sessionStorage.setItem('userName', data.name || data.username || 'Student');
    sessionStorage.setItem('userEmail', cred.user.email || '');
    sessionStorage.setItem('studentUsername', data.username || '');
    sessionStorage.setItem('studentClass', data.class || '');
    sessionStorage.setItem('schoolId', data.schoolId || '');
    sessionStorage.setItem('schoolName', data.schoolName || '');
    localStorage.setItem('jaystar_cached_user_name', data.name || data.username || 'Student');
    await recordPortalLogin('STUDENT');
    navigate('/portal/student');
  };

  const handleSchoolLogin = async () => {
    const rawInput = identifier.trim();
    const code = password.trim();
    if (!rawInput || !code) throw new Error('Please enter your School Email / Access Code or Cadet Username and Passcode.');

    if (rawInput.includes('@')) {
      try {
        const cred = await signInWithEmailAndPassword(auth, rawInput.toLowerCase(), code);
        const userSnap = await getDoc(doc(db, 'users', cred.user.uid));
        const userData = userSnap.data() || {};

        if (cred.user.email === 'johnrufai242@gmail.com' || (userData.role || '').toUpperCase().includes('ADMIN')) {
          sessionStorage.setItem('userRole', 'super_admin');
          sessionStorage.setItem('userId', cred.user.uid);
          await recordPortalLogin('ADMIN');
          navigate('/admin');
          return;
        }

        const schoolName = userData.name || 'Partner School';
        sessionStorage.setItem('userRole', 'school');
        sessionStorage.setItem('userId', cred.user.uid);
        sessionStorage.setItem('schoolId', userData.schoolId || cred.user.uid);
        sessionStorage.setItem('schoolDocId', userData.schoolId || cred.user.uid);
        sessionStorage.setItem('userName', schoolName);
        await recordPortalLogin('SCHOOL');
        navigate('/portal/school');
        return;
      } catch (authErr) {
        console.warn('Direct school auth notice:', authErr);
      }
    }

    const response = await fetch('/.netlify/functions/portal-access-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'school', identifier: rawInput, code })
    });
    const data = await response.json();
    if (!response.ok || !data.customToken) {
      throw new Error(data.error || 'Invalid school credentials.');
    }

    const cred = await signInWithCustomToken(auth, data.customToken);
    sessionStorage.setItem('userRole', 'school');
    sessionStorage.setItem('userId', cred.user.uid);
    sessionStorage.setItem('schoolId', data.schoolId || data.schoolDocId || '');
    sessionStorage.setItem('schoolDocId', data.schoolDocId || data.schoolId || '');
    sessionStorage.setItem('userName', data.name || 'Partner School');
    localStorage.setItem('jaystar_cached_user_name', data.name || 'Partner School');
    await recordPortalLogin('SCHOOL');
    navigate('/portal/school');
  };

  const handleGeneralLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (activeTab === 'student') {
      setLoading(true);
      try {
        await handleStudentLogin();
      } catch (err: any) {
        console.error('Student login error:', err);
        setError(err.message || 'Login failed. Please check your credentials.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (activeTab === 'school') {
      setLoading(true);
      try {
        await handleSchoolLogin();
      } catch (err: any) {
        console.error('School login error:', err);
        setError(err.message || 'Login failed. Please check your credentials.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Parent or Staff Email Login
    const email = identifier.trim();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      const user = cred.user;
      
      // 1. Super admin check
      if (user.email === 'johnrufai242@gmail.com') {
        sessionStorage.setItem('userRole', 'super_admin');
        sessionStorage.setItem('userId', user.uid);
        sessionStorage.setItem('userEmail', user.email || '');
        navigate('/admin');
        return;
      }

      // 2. Fetch user profile
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      let userData = userSnap.exists() ? userSnap.data() : null;

      // If user doc doesn't exist yet, check parents, tutors, or individualStudents
      let detectedRole = '';
      let detectedName = user.displayName || email.split('@')[0];

      if (userData) {
        detectedRole = (userData.role || '').toUpperCase();
        if (userData.name) detectedName = userData.name;
      } else {
        // Fallback check parents collection
        const parentDoc = await getDoc(doc(db, 'parents', user.uid));
        if (parentDoc.exists()) {
          detectedRole = 'PARENT';
          if (parentDoc.data().name) detectedName = parentDoc.data().name;
        }

        // Fallback check tutors collection
        if (!detectedRole) {
          const tutorDoc = await getDoc(doc(db, 'tutors', user.uid));
          if (tutorDoc.exists()) {
            detectedRole = 'STAFF';
            if (tutorDoc.data().name) detectedName = tutorDoc.data().name;
          }
        }

        // Auto-create user document
        const initialRole = detectedRole ? detectedRole.toLowerCase() : activeTab;
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email?.toLowerCase(),
          name: detectedName,
          role: initialRole,
          createdAt: serverTimestamp()
        });
        detectedRole = initialRole.toUpperCase();
      }

      // Check admin
      if (detectedRole.includes('ADMIN')) {
        sessionStorage.setItem('userRole', 'super_admin');
        sessionStorage.setItem('userId', user.uid);
        sessionStorage.setItem('userEmail', user.email || '');
        sessionStorage.setItem('userName', detectedName || 'Admin');
        localStorage.setItem('jaystar_cached_user_role', 'super_admin');
        localStorage.setItem('jaystar_cached_user_id', user.uid);
        localStorage.setItem('jaystar_cached_user_name', detectedName || 'Admin');
        navigate('/admin');
        return;
      }

      // Smart role routing: If user logged in from any tab, route them to their proper portal destination seamlessly
      const targetRole = detectedRole || activeTab.toUpperCase();
      let targetRoute = `/portal/${activeTab}`;
      let sessionRole: string = activeTab;

      if (targetRole === 'STUDENT' || targetRole === 'INDIVIDUALSTUDENT') {
        targetRoute = '/portal/student';
        sessionRole = 'student';
      } else if (targetRole === 'SCHOOL') {
        targetRoute = '/portal/school';
        sessionRole = 'school';
      } else if (targetRole === 'PARENT') {
        targetRoute = '/portal/parent';
        sessionRole = 'parent';
      } else if (targetRole === 'STAFF' || targetRole === 'TUTOR') {
        targetRoute = '/portal/staff';
        sessionRole = 'staff';
      }

      sessionStorage.setItem('userRole', sessionRole);
      sessionStorage.setItem('userId', user.uid);
      sessionStorage.setItem('userEmail', user.email || '');
      sessionStorage.setItem('userName', detectedName);
      localStorage.setItem('jaystar_cached_user_role', sessionRole);
      localStorage.setItem('jaystar_cached_user_id', user.uid);
      localStorage.setItem('jaystar_cached_user_name', detectedName);

      await recordPortalLogin(sessionRole);
      navigate(targetRoute);
    } catch (err: any) {
      console.error('Login error:', err);
      let msg = err.message || 'Invalid credentials. Please try again.';
      if (
        err.code === 'auth/user-not-found' || 
        err.code === 'auth/invalid-credential' || 
        err.code === 'auth/invalid-login-credentials'
      ) {
        msg = 'No account found with these credentials. Please check your email and password, or register below.';
      } else if (err.code === 'auth/wrong-password') {
        msg = 'Incorrect password. Please try again or reset your password.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.message && (err.message.includes('Database is closing') || err.message.includes('IndexedDB'))) {
        msg = 'Authentication storage reconnected. Please click login again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      const user = result.user;
      const userSnap = await getDoc(doc(db, 'users', user.uid));

      let userRole = user.email === 'johnrufai242@gmail.com' ? 'SUPER_ADMIN' : activeTab.toUpperCase();

      if (!userSnap.exists()) {
        // Check for pending invite
        const inviteDocRef = doc(db, 'invites', (user.email || '').toLowerCase());
        const inviteSnap = await getDoc(inviteDocRef);
        
        if (inviteSnap.exists()) {
          userRole = inviteSnap.data().role;
          await deleteDoc(inviteDocRef);
        }

        // Auto-create for first-time Google sign-in
        const newRecord = {
          email: user.email,
          name: user.displayName || '',
          role: activeTab === 'parent' ? 'parent' : userRole.toLowerCase(),
          createdAt: serverTimestamp()
        };

        await setDoc(doc(db, 'users', user.uid), newRecord);
        if (activeTab === 'parent') {
          await setDoc(doc(db, 'parents', user.uid), newRecord, { merge: true });
        }
      } else {
        const userData = userSnap.data();
        userRole = user.email === 'johnrufai242@gmail.com' ? 'SUPER_ADMIN' : (userData.role || 'USER').toUpperCase();
      }

      if (userRole.includes('ADMIN') || user.email === 'johnrufai242@gmail.com') {
        sessionStorage.setItem('userRole', 'super_admin');
        sessionStorage.setItem('userId', user.uid);
        sessionStorage.setItem('userEmail', user.email || '');
        sessionStorage.setItem('userName', user.displayName || 'Admin');
        localStorage.setItem('jaystar_cached_user_role', 'super_admin');
        localStorage.setItem('jaystar_cached_user_id', user.uid);
        localStorage.setItem('jaystar_cached_user_name', user.displayName || 'Admin');
        await recordPortalLogin('ADMIN');
        navigate('/admin');
        return;
      }

      // Route smoothly according to real user role
      let targetRoute = `/portal/${activeTab}`;
      let sessionRole = activeTab;

      if (userRole === 'STUDENT' || userRole === 'INDIVIDUALSTUDENT') {
        targetRoute = '/portal/student';
        sessionRole = 'student';
      } else if (userRole === 'SCHOOL') {
        targetRoute = '/portal/school';
        sessionRole = 'school';
      } else if (userRole === 'PARENT') {
        targetRoute = '/portal/parent';
        sessionRole = 'parent';
      } else if (userRole === 'STAFF' || userRole === 'TUTOR') {
        targetRoute = '/portal/staff';
        sessionRole = 'staff';
      }
      
      sessionStorage.setItem('userRole', sessionRole);
      sessionStorage.setItem('userId', user.uid);
      sessionStorage.setItem('userEmail', user.email || '');
      sessionStorage.setItem('userName', user.displayName || '');
      localStorage.setItem('jaystar_cached_user_role', sessionRole);
      localStorage.setItem('jaystar_cached_user_id', user.uid);
      localStorage.setItem('jaystar_cached_user_name', user.displayName || '');

      await recordPortalLogin(sessionRole);
      navigate(targetRoute);
    } catch (err: any) {
      console.error('Google login error:', err);
      let msg = err.message || 'Google sign-in failed.';
      if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in popup was closed before completion.';
      } else if (err.code === 'auth/popup-blocked') {
        msg = 'Sign-in popup was blocked by your browser. Please allow popups or use email & password to sign in.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        msg = 'Sign-in cancelled. Please try again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (staffPw.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      // Check registration code
      let validCode = STAFF_REG_CODE_FALLBACK;
      try {
        const codeSnap = await getDoc(doc(db, 'staffRegistration', 'code'));
        if (codeSnap.exists() && codeSnap.data().code) {
          validCode = codeSnap.data().code;
        }
      } catch (e) {
        console.warn('Could not read staffRegistration code doc, using default fallback:', e);
      }

      if (staffRegCode.trim() !== validCode) {
        throw new Error('Invalid staff registration code. Please contact your Institute Admin.');
      }

      const cred = await createUserWithEmailAndPassword(auth, staffEmail.trim(), staffPw);
      
      const staffDocData = {
        email: staffEmail.trim().toLowerCase(),
        name: staffName.trim(),
        role: 'staff',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', cred.user.uid), staffDocData);
      await setDoc(doc(db, 'tutors', cred.user.uid), staffDocData);

      setSuccess('Staff account created successfully! You can now log in.');
      setShowStaffReg(false);
      setIdentifier(staffEmail.trim());
      setPassword(staffPw);
    } catch (err: any) {
      let msg = err.message || 'Staff registration failed.';
      if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered. Please log in instead.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Role; label: string; icon: React.ReactNode }[] = [
    { id: 'student', label: 'Students', icon: <GraduationCap size={16} /> },
    { id: 'school', label: 'Schools', icon: <School size={16} /> },
    { id: 'parent', label: 'Parents', icon: <Users size={16} /> },
    { id: 'staff', label: 'Staff', icon: <ShieldCheck size={16} /> },
  ];

  return (
    <div className={`jdh-portal ${theme === 'dark' ? 'dark' : 'light'}`}>
      <SEO 
        title="Academy & Client Portal — Jaystarbliss Studios" 
        description="Access student dashboards, school portals, parent progress reports, and staff workspace." 
      />
      <div className="scanlines"></div>
      
      <div className="card">
        {/* LEFT DECO PANEL */}
        <div className="deco-panel relative">
          <CyberTerrainCanvas theme={theme} />

          {/* Top-Left Clean Brand Header */}
          <Link to="/" className="deco-brand flex items-center gap-3 select-none group" aria-label="Home">
            <JaystarblissIcon className="w-9 h-9 rounded-xl group-hover:scale-105 transition-transform shrink-0" />
            <span className="font-black text-base tracking-wider uppercase whitespace-nowrap">
              JAYSTARBLISS STUDIOS
            </span>
          </Link>

          {/* Center Floating 3D Octagonal Prism Centerpiece above Horizon */}
          <div className="deco-center-stage">
            <div className="stage-glow-reflection" />
            <ThreeOctagonLogo size={185} className="relative z-10" />
          </div>
          
          {/* Bottom Tagline */}
          <div className="deco-bottom">
            <div className="deco-tagline">Learn. <br/><span>Grow.</span> <br/>Thrive.</div>
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="form-panel">
          <div className="role-tabs">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                type="button"
                className={`role-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { 
                  setActiveTab(tab.id); 
                  setError(''); 
                  setSuccess('');
                  setIdentifier(''); 
                  setPassword(''); 
                  setShowStaffReg(false);
                }}
              >
                <span className="tab-ico">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="form-body">
            {showStaffReg ? (
              <div className="pane">
                <div className="form-title">Staff <em>Registration</em></div>
                <div className="form-sub">Enter your staff authorization credentials</div>

                {error && <div className="msg msg-error show">{error}</div>}
                {success && <div className="msg msg-success show">{success}</div>}

                <form onSubmit={handleStaffRegistration}>
                  <div className="field">
                    <label>Staff Registration Code</label>
                    <div className="input-wrap">
                      <span className="input-icon"><KeyRound size={15} /></span>
                      <input 
                        type="text" 
                        placeholder="e.g. JAYSTAR2024" 
                        required 
                        value={staffRegCode}
                        onChange={e => setStaffRegCode(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Full Name</label>
                    <div className="input-wrap">
                      <span className="input-icon"><UserCheck size={15} /></span>
                      <input 
                        type="text" 
                        placeholder="Instructor Name" 
                        required 
                        value={staffName}
                        onChange={e => setStaffName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Official Email</label>
                    <div className="input-wrap">
                      <span className="input-icon"><Mail size={15} /></span>
                      <input 
                        type="email" 
                        placeholder="tutor@jaystarbliss.ng" 
                        required 
                        value={staffEmail}
                        onChange={e => setStaffEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Create Password</label>
                    <div className="input-wrap">
                      <span className="input-icon"><Lock size={15} /></span>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className="has-eye" 
                        placeholder="Min 6 characters" 
                        required 
                        value={staffPw}
                        onChange={e => setStaffPw(e.target.value)}
                      />
                      <button type="button" className="pw-eye" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <CyberLiquidButton type="submit" loading={loading}>
                    Complete Staff Registration →
                  </CyberLiquidButton>

                  <div className="toggle-link mt-4">
                    Already registered? <button type="button" onClick={() => setShowStaffReg(false)} className="font-semibold underline" style={{ color: 'var(--link)' }}>Back to Login</button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="pane">
                <div className="form-title capitalize">{activeTab} <em>Portal Login</em></div>
                <div className="form-sub">
                  {activeTab === 'student' && 'Enter your Student Username & Access Code'}
                  {activeTab === 'school' && 'Enter your School Email or Partner Access Code'}
                  {activeTab === 'parent' && 'Sign in to monitor your children’s classes & progress'}
                  {activeTab === 'staff' && 'Sign in to your tutor & instructor workspace'}
                </div>
                
                {error && <div className="msg msg-error show">{error}</div>}
                {success && <div className="msg msg-success show">{success}</div>}
                
                <form onSubmit={handleGeneralLogin} autoComplete="on">
                  <div className="field">
                    <label>
                      {activeTab === 'student' && 'Student Username or Email'}
                      {activeTab === 'school' && 'School Email or Terminal ID'}
                      {activeTab === 'parent' && 'Parent Email Address'}
                      {activeTab === 'staff' && 'Staff / Tutor Email'}
                    </label>
                    <div className="input-wrap">
                      <span className="input-icon"><Mail size={15} /></span>
                      <input 
                        type={activeTab === 'student' || activeTab === 'school' ? 'text' : 'email'} 
                        placeholder={
                          activeTab === 'student' ? 'e.g. john or john@example.com' :
                          activeTab === 'school' ? 'school@institution.edu' :
                          activeTab === 'parent' ? 'parent@example.com' : 'staff@jaystarbliss.ng'
                        } 
                        required 
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="field">
                    <label>
                      {activeTab === 'student' ? 'Student Access Code (Password)' : 'Password / Access Code'}
                    </label>
                    <div className="input-wrap">
                      <span className="input-icon"><Lock size={15} /></span>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className="has-eye" 
                        placeholder="••••••••" 
                        required 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                      <button type="button" className="pw-eye" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '-0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="checkbox" 
                        id="rememberMe" 
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        style={{ width: 'auto' }} 
                      />
                      <label htmlFor="rememberMe" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-dim)', textTransform: 'none', letterSpacing: 'normal' }}>
                        Remember me
                      </label>
                    </div>

                    {activeTab === 'staff' && (
                      <button 
                        type="button" 
                        onClick={() => { setShowStaffReg(true); setError(''); setSuccess(''); }}
                        className="text-xs font-semibold hover:underline"
                        style={{ color: 'var(--link)' }}
                      >
                        Register as Staff
                      </button>
                    )}
                  </div>
                  
                  <CyberLiquidButton type="submit" loading={loading}>
                    {activeTab === 'student' ? 'LAUNCH STUDENT HUB →' : 'INITIALIZE ACCESS →'}
                  </CyberLiquidButton>
                </form>

                {(activeTab === 'parent' || activeTab === 'staff') && (
                  <>
                    <div className="auth-divider">or</div>
                    <button type="button" className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.5 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20c10.8 0 19.6-8.5 19.6-20 0-1.3-.1-2.6-.4-3.9z"/>
                        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5 16.3 5 9.7 9 6.3 14.7z"/>
                        <path fill="#4CAF50" d="M24 45c4.9 0 9.3-1.8 12.7-4.8l-5.9-5c-1.8 1.3-4 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2l-6.5 5C9.5 41 16.2 45 24 45z"/>
                        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4-4.1 5.3l5.9 5C36.7 39.8 44 34.3 44 25c0-1.3-.1-2.6-.4-3.9z"/>
                      </svg>
                      <span className="btn-text">Continue with Google</span>
                    </button>
                  </>
                )}

                <div className="toggle-link">
                  Don't have an account yet? <Link to="/register">Register / Enroll Here →</Link>
                </div>
              </div>
            )}
          </div>

          <div className="form-foot">
            <Link to="/" className="back-link"><ArrowLeft size={14} /> Main Site</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.55rem', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Build v4.5.0
              </span>
              <button type="button" className="theme-btn" onClick={toggleTheme} title="Toggle theme">
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portal;

