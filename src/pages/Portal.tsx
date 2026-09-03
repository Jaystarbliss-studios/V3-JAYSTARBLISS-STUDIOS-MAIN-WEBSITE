import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  School, GraduationCap, Users, ShieldCheck, Mail, Lock, 
  Eye, EyeOff, ArrowLeft, Sun, Moon, KeyRound, UserCheck
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithCustomToken,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { 
  doc, getDoc, setDoc, updateDoc, collection, 
  query, where, getDocs, serverTimestamp, deleteDoc 
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

  const tryPortalAccessFunction = async (role: 'student' | 'school', identifierValue: string, codeValue: string) => {
    const response = await fetch('/.netlify/functions/portal-access-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, identifier: identifierValue, code: codeValue })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.customToken) throw new Error(data.error || 'Invalid portal credentials.');
    const cred = await signInWithCustomToken(auth, data.customToken);
    return { data, user: cred.user };
  };

  const handleStudentLogin = async () => {
    const rawInput = identifier.trim();
    const code = password.trim();

    if (!rawInput || !code) {
      throw new Error('Please enter both your Student Username / Email and Access Code.');
    }

    const isRealEmail = rawInput.includes('@') && !rawInput.endsWith('.local');

    // Verify username/access-code credentials on the server so private student records
    // are never exposed through public client-side lookups.
    try {
      const result = await tryPortalAccessFunction('student', rawInput, code);
      const studentName = result.data.name || rawInput;
      sessionStorage.setItem('userRole', 'student');
      sessionStorage.setItem('userId', result.user.uid);
      sessionStorage.setItem('studentDocId', result.data.studentDocId || '');
      sessionStorage.setItem('userName', studentName);
      sessionStorage.setItem('studentUsername', result.data.username || '');
      sessionStorage.setItem('studentClass', result.data.class || '');
      sessionStorage.setItem('schoolId', result.data.schoolId || '');
      sessionStorage.setItem('schoolName', result.data.schoolName || '');
      localStorage.setItem('jaystar_cached_user_role', 'student');
      localStorage.setItem('jaystar_cached_user_id', result.user.uid);
      localStorage.setItem('jaystar_cached_user_name', studentName);
      toast.success(`Welcome Cadet ${String(studentName).split(' ')[0]}! Logged in successfully.`);
      navigate('/portal/student');
      return;
    } catch (portalAccessErr) {
      console.warn('Server-side student portal lookup notice:', portalAccessErr);
    }

    // 1. If it's a real email, try direct Firebase Auth first
    if (isRealEmail) {
      try {
        const cred = await signInWithEmailAndPassword(auth, rawInput.toLowerCase(), code);
        const user = cred.user;
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.data() || {};
        
        // If super admin or admin logged in on student tab
        if (user.email === 'johnrufai242@gmail.com' || (userData.role || '').toUpperCase().includes('ADMIN')) {
          sessionStorage.setItem('userRole', 'super_admin');
          sessionStorage.setItem('userId', user.uid);
          sessionStorage.setItem('userEmail', user.email || '');
          navigate('/admin');
          return;
        }

        // Check if student doc exists in individualStudents
        let studentDocId = user.uid;
        let studentName = userData.name || user.displayName || rawInput.split('@')[0];
        try {
          const sQuery = query(collection(db, 'individualStudents'), where('email', '==', rawInput.toLowerCase()));
          const sSnap = await getDocs(sQuery);
          if (!sSnap.empty) {
            studentDocId = sSnap.docs[0].id;
            studentName = sSnap.docs[0].data().fullName || studentName;
          }
        } catch {
          // Non-fatal
        }

        sessionStorage.setItem('userRole', 'student');
        sessionStorage.setItem('userId', user.uid);
        sessionStorage.setItem('studentDocId', studentDocId);
        sessionStorage.setItem('userName', studentName);
        sessionStorage.setItem('userEmail', user.email || '');

        navigate('/portal/student');
        return;
      } catch (directAuthErr: any) {
        // If it was invalid credentials and it looks like a student access code rather than standard password, proceed to student record lookup
        console.warn('Direct student email auth notice:', directAuthErr?.code);
      }
    }

    // 2. Look up student in individualStudents (by username, email, accessCode, or doc ID)
    let sdoc: any = null;
    let sdata: any = null;

    try {
      // Check by username
      const cleanUsername = rawInput.toLowerCase().replace(/^@/, '').replace(/\s+/g, '');
      const usernameQuery = query(
        collection(db, 'individualStudents'),
        where('username', '==', cleanUsername)
      );
      const uSnap = await getDocs(usernameQuery);
      if (!uSnap.empty) {
        sdoc = uSnap.docs[0];
        sdata = sdoc.data();
      }

      // Check by email
      if (!sdoc && isRealEmail) {
        const emailQuery = query(
          collection(db, 'individualStudents'),
          where('email', '==', rawInput.toLowerCase())
        );
        const eSnap = await getDocs(emailQuery);
        if (!eSnap.empty) {
          sdoc = eSnap.docs[0];
          sdata = sdoc.data();
        }
      }

      // Check by accessCode if input was access code
      if (!sdoc) {
        const codeQuery = query(
          collection(db, 'individualStudents'),
          where('accessCode', '==', rawInput.toUpperCase())
        );
        const cSnap = await getDocs(codeQuery);
        if (!cSnap.empty) {
          sdoc = cSnap.docs[0];
          sdata = sdoc.data();
        }
      }

      // Check by document ID
      if (!sdoc) {
        try {
          const directDocSnap = await getDoc(doc(db, 'individualStudents', rawInput));
          if (directDocSnap.exists()) {
            sdoc = directDocSnap;
            sdata = directDocSnap.data();
          }
        } catch {
          // Not a doc ID
        }
      }

      // Check in legacy students collection
      if (!sdoc) {
        const legacyQuery = query(
          collection(db, 'students'),
          where('email', '==', rawInput.toLowerCase())
        );
        const lSnap = await getDocs(legacyQuery);
        if (!lSnap.empty) {
          sdoc = lSnap.docs[0];
          sdata = sdoc.data();
        }
      }
    } catch (lookupErr) {
      console.warn('Firestore student lookup info:', lookupErr);
    }

    // Verify access code if student record found with accessCode
    if (sdoc && sdata) {
      if (sdata.accessCode) {
        const storedCode = String(sdata.accessCode).trim().toUpperCase();
        const enteredCode = code.trim().toUpperCase();
        if (storedCode !== enteredCode && sdata.accessCode !== code) {
          throw new Error('Invalid access code for this student profile. Please verify your access code or contact your instructor.');
        }
      }
    }

    const effectiveUsername = (sdata?.username || rawInput).toLowerCase().replace(/^@/, '').replace(/\s+/g, '');
    const authEmailToUse = isRealEmail ? rawInput.toLowerCase() : studentAuthEmail(effectiveUsername);
    const authPassword = deriveStudentAuthPassword(code.toUpperCase());

    let firebaseUid = '';

    try {
      const cred = await signInWithEmailAndPassword(auth, authEmailToUse, authPassword);
      firebaseUid = cred.user.uid;
    } catch (authErr: any) {
      // Also try with original code case if uppercase failed
      let secondTrySuccess = false;
      if (code !== code.toUpperCase()) {
        try {
          const cred2 = await signInWithEmailAndPassword(auth, authEmailToUse, deriveStudentAuthPassword(code));
          firebaseUid = cred2.user.uid;
          secondTrySuccess = true;
        } catch {
          // Ignore
        }
      }

      if (!secondTrySuccess) {
        if (
          authErr.code === 'auth/user-not-found' ||
          authErr.code === 'auth/invalid-credential' ||
          authErr.code === 'auth/invalid-login-credentials'
        ) {
          // First login — auto create Firebase Auth account
          try {
            const cred = await createUserWithEmailAndPassword(auth, authEmailToUse, authPassword);
            firebaseUid = cred.user.uid;
          } catch (createErr: any) {
            if (createErr.code === 'auth/email-already-in-use') {
              throw new Error('Incorrect access code for this student account.');
            }
            if (createErr.code === 'auth/weak-password') {
              throw new Error('Access code or password must be at least 6 characters.');
            }
            throw createErr;
          }
        } else if (authErr.code === 'auth/wrong-password') {
          throw new Error('Access code mismatch. Your instructor may have updated your code — please contact them.');
        } else if (authErr.code === 'auth/weak-password') {
          throw new Error('Password should be at least 6 characters.');
        } else {
          throw authErr;
        }
      }
    }

    // Ensure users doc exists while preserving admin rights
    const userDocRef = doc(db, 'users', firebaseUid);
    const existingSnap = await getDoc(userDocRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};
    const isAdmin = authEmailToUse === 'johnrufai242@gmail.com' || (existingData.role || '').toUpperCase().includes('ADMIN');

    if (isAdmin) {
      sessionStorage.setItem('userRole', 'super_admin');
      sessionStorage.setItem('userId', firebaseUid);
      localStorage.setItem('jaystar_cached_user_role', 'super_admin');
      localStorage.setItem('jaystar_cached_user_id', firebaseUid);
      navigate('/admin');
      return;
    }

    await setDoc(userDocRef, {
      email: authEmailToUse,
      name: sdata?.fullName || existingData.name || effectiveUsername,
      role: 'student',
      studentDocId: sdoc ? sdoc.id : firebaseUid,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Backfill firebaseUid into individualStudents doc if needed
    if (sdoc && (!sdata.firebaseUid || sdata.firebaseUid !== firebaseUid)) {
      try {
        await updateDoc(doc(db, 'individualStudents', sdoc.id), {
          firebaseUid,
          authEmail: authEmailToUse
        });
      } catch (upErr) {
        console.warn('Student firebaseUid backfill non-fatal:', upErr);
      }
    }

    const studentName = sdata?.fullName || existingData.name || effectiveUsername;
    sessionStorage.setItem('userRole', 'student');
    sessionStorage.setItem('userId', firebaseUid);
    sessionStorage.setItem('studentDocId', sdoc ? sdoc.id : firebaseUid);
    sessionStorage.setItem('userName', studentName);
    sessionStorage.setItem('studentUsername', effectiveUsername);
    sessionStorage.setItem('studentClass', sdata?.class || sdata?.grade || '');
    sessionStorage.setItem('schoolId', sdata?.schoolId || '');
    sessionStorage.setItem('schoolName', sdata?.schoolName || '');
    
    localStorage.setItem('jaystar_cached_user_role', 'student');
    localStorage.setItem('jaystar_cached_user_id', firebaseUid);
    localStorage.setItem('jaystar_cached_user_name', studentName);

    navigate('/portal/student');
  };

  const handleSchoolLogin = async () => {
    const rawInput = identifier.trim();
    const code = password.trim();

    if (!rawInput || !code) {
      throw new Error('Please enter your School Email / Access Code or Cadet Username and Passcode.');
    }

    // 1. Try direct Firebase Auth
    if (rawInput.includes('@')) {
      try {
        const cred = await signInWithEmailAndPassword(auth, rawInput.toLowerCase(), code);
        const userSnap = await getDoc(doc(db, 'users', cred.user.uid));
        const userData = userSnap.data() || {};
        
        if (cred.user.email === 'johnrufai242@gmail.com' || (userData.role || '').toUpperCase().includes('ADMIN')) {
          sessionStorage.setItem('userRole', 'super_admin');
          sessionStorage.setItem('userId', cred.user.uid);
          localStorage.setItem('jaystar_cached_user_role', 'super_admin');
          localStorage.setItem('jaystar_cached_user_id', cred.user.uid);
          navigate('/admin');
          return;
        }

        if (userData.role === 'student') {
          const studentName = userData.name || rawInput.split('@')[0];
          sessionStorage.setItem('userRole', 'student');
          sessionStorage.setItem('userId', cred.user.uid);
          sessionStorage.setItem('studentDocId', userData.studentDocId || cred.user.uid);
          sessionStorage.setItem('userName', studentName);
          sessionStorage.setItem('studentUsername', rawInput.split('@')[0]);
          sessionStorage.setItem('studentClass', userData.class || userData.grade || '');
          sessionStorage.setItem('schoolId', userData.schoolId || '');
          sessionStorage.setItem('schoolName', userData.schoolName || '');
          localStorage.setItem('jaystar_cached_user_role', 'student');
          localStorage.setItem('jaystar_cached_user_id', cred.user.uid);
          localStorage.setItem('jaystar_cached_user_name', studentName);
          navigate('/portal/student');
          return;
        }

        const schoolName = userData.name || 'Partner School';
        sessionStorage.setItem('userRole', 'school');
        sessionStorage.setItem('userId', cred.user.uid);
        sessionStorage.setItem('schoolId', userData.schoolId || cred.user.uid);
        sessionStorage.setItem('userName', schoolName);
        localStorage.setItem('jaystar_cached_user_role', 'school');
        localStorage.setItem('jaystar_cached_user_id', cred.user.uid);
        localStorage.setItem('jaystar_cached_user_name', schoolName);
        navigate('/portal/school');
        return;
      } catch (authErr) {
        console.warn('Direct auth failed, checking schools collection:', authErr);
      }
    }

    // 2. Verify school access server-side. The schools collection contains
    // portal credentials and is intentionally not publicly readable.
    let matchedSchool: any = null;
    try {
      const result = await tryPortalAccessFunction('school', rawInput, code);
      matchedSchool = {
        id: result.data.schoolDocId || result.data.schoolId,
        name: result.data.name || 'Partner School',
        email: result.user.email || undefined,
        firebaseUid: result.user.uid
      };
    } catch (portalAccessErr) {
      console.warn('Server-side school portal lookup notice:', portalAccessErr);
    }

    if (!matchedSchool) {
      // 3. Check if this is a School Cadet logging in with their Username / Access Code and Passcode
      try {
        let sdoc: any = null;
        let sdata: any = null;

        const cleanUsername = rawInput.toLowerCase().replace(/^@/, '').replace(/\s+/g, '');
        const uQuery = query(collection(db, 'individualStudents'), where('username', '==', cleanUsername));
        const uSnap = await getDocs(uQuery);
        if (!uSnap.empty) {
          sdoc = uSnap.docs[0];
          sdata = sdoc.data();
        }

        if (!sdoc) {
          const cQuery = query(collection(db, 'individualStudents'), where('accessCode', '==', rawInput.toUpperCase()));
          const cSnap = await getDocs(cQuery);
          if (!cSnap.empty) {
            sdoc = cSnap.docs[0];
            sdata = cSnap.docs[0].data();
          }
        }

        if (!sdoc) {
          const eQuery = query(collection(db, 'individualStudents'), where('email', '==', rawInput.toLowerCase()));
          const eSnap = await getDocs(eQuery);
          if (!eSnap.empty) {
            sdoc = eSnap.docs[0];
            sdata = sdoc.data();
          }
        }

        if (sdoc && sdata) {
          const storedCode = String(sdata.accessCode || sdata.passcode || '').trim().toUpperCase();
          const enteredCode = code.trim().toUpperCase();
          if (storedCode === enteredCode || sdata.accessCode === code || sdata.passcode === code) {
            // Sign in or create auth session for student
            const effectiveUsername = (sdata.username || cleanUsername || 'cadet').toLowerCase();
            const authEmailToUse = sdata.email || studentAuthEmail(effectiveUsername);
            const authPassword = deriveStudentAuthPassword(code.toUpperCase());
            let firebaseUid = '';

            try {
              const cred = await signInWithEmailAndPassword(auth, authEmailToUse, authPassword);
              firebaseUid = cred.user.uid;
            } catch (e: any) {
              if (
                e.code === 'auth/user-not-found' || 
                e.code === 'auth/invalid-credential' ||
                e.code === 'auth/invalid-login-credentials'
              ) {
                const cred = await createUserWithEmailAndPassword(auth, authEmailToUse, authPassword);
                firebaseUid = cred.user.uid;
              } else {
                throw e;
              }
            }

            await setDoc(doc(db, 'users', firebaseUid), {
              email: authEmailToUse,
              name: sdata.fullName || sdata.studentName || effectiveUsername,
              role: 'student',
              schoolId: sdata.schoolId || '',
              schoolName: sdata.schoolName || '',
              studentDocId: sdoc.id,
              class: sdata.class || sdata.grade || '',
              updatedAt: serverTimestamp()
            }, { merge: true });

            const studentName = sdata.fullName || sdata.studentName || effectiveUsername;
            sessionStorage.setItem('userRole', 'student');
            sessionStorage.setItem('userId', firebaseUid);
            sessionStorage.setItem('studentDocId', sdoc.id);
            sessionStorage.setItem('userName', studentName);
            sessionStorage.setItem('studentUsername', effectiveUsername);
            sessionStorage.setItem('studentClass', sdata.class || sdata.grade || '');
            sessionStorage.setItem('schoolId', sdata.schoolId || '');
            sessionStorage.setItem('schoolName', sdata.schoolName || '');
            localStorage.setItem('jaystar_cached_user_role', 'student');
            localStorage.setItem('jaystar_cached_user_id', firebaseUid);
            localStorage.setItem('jaystar_cached_user_name', studentName);

            toast.success(`Welcome Cadet ${studentName.split(' ')[0]}! Logged in successfully.`);
            navigate('/portal/student');
            return;
          }
        }
      } catch (cadetErr) {
        console.warn('Cadet login lookup notice:', cadetErr);
      }

      throw new Error('Invalid school credentials, cadet username, or access passcode. Please verify your credentials or contact your school administrator.');
    }

    // The server-side function already created/signs in the Firebase session with a custom token.
    // Do not attempt a second email/password sign-in for this credential-based path.
    if (matchedSchool.firebaseUid) {
      const matchedSchoolName = matchedSchool.name || 'Partner School';
      sessionStorage.setItem('userRole', 'school');
      sessionStorage.setItem('userId', matchedSchool.firebaseUid);
      sessionStorage.setItem('schoolId', matchedSchool.id);
      sessionStorage.setItem('userName', matchedSchoolName);
      localStorage.setItem('jaystar_cached_user_role', 'school');
      localStorage.setItem('jaystar_cached_user_id', matchedSchool.firebaseUid);
      localStorage.setItem('jaystar_cached_user_name', matchedSchoolName);
      toast.success(`Welcome ${matchedSchoolName}! Logged in successfully.`);
      navigate('/portal/school');
      return;
    }

    // Legacy email/password school accounts remain supported.
    // Sign in or create auth session for school
    const schoolAuthEmail = matchedSchool.email || `school-${matchedSchool.id.toLowerCase().replace(/[^a-z0-9]/g, '')}@jdh-school.local`;
    const schoolAuthPassword = deriveSchoolAuthPassword(code);
    let firebaseUid = '';

    try {
      const cred = await signInWithEmailAndPassword(auth, schoolAuthEmail, schoolAuthPassword);
      firebaseUid = cred.user.uid;
    } catch (e: any) {
      if (
        e.code === 'auth/user-not-found' || 
        e.code === 'auth/invalid-credential' ||
        e.code === 'auth/invalid-login-credentials'
      ) {
        const cred = await createUserWithEmailAndPassword(auth, schoolAuthEmail, schoolAuthPassword);
        firebaseUid = cred.user.uid;
      } else if (e.code === 'auth/weak-password') {
        throw new Error('Access code or password must be at least 6 characters.');
      } else {
        throw e;
      }
    }

    await setDoc(doc(db, 'users', firebaseUid), {
      email: schoolAuthEmail,
      name: matchedSchool.name || 'Partner School',
      role: 'school',
      schoolId: matchedSchool.id,
      updatedAt: serverTimestamp()
    }, { merge: true });

    const matchedSchoolName = matchedSchool.name || 'Partner School';
    sessionStorage.setItem('userRole', 'school');
    sessionStorage.setItem('userId', firebaseUid);
    sessionStorage.setItem('schoolId', matchedSchool.id);
    sessionStorage.setItem('userName', matchedSchoolName);
    localStorage.setItem('jaystar_cached_user_role', 'school');
    localStorage.setItem('jaystar_cached_user_id', firebaseUid);
    localStorage.setItem('jaystar_cached_user_name', matchedSchoolName);

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

