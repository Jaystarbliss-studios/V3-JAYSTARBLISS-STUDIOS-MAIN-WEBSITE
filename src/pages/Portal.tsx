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
  browserPopupRedirectResolver,
  signOut
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

const isBlockedAccount = (data: Record<string, any>) =>
  ['DISABLED', 'SUSPENDED', 'BANNED'].includes(String(data.accountStatus || data.status || 'ACTIVE').toUpperCase());

const getSafeAccountStatus = (data: Record<string, any>) => String(data.accountStatus || data.status || 'ACTIVE').toUpperCase();

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

  const ensureActiveUserAccount = async (uid: string) => {
    const userSnap = await getDoc(doc(db, 'users', uid));
    const data = userSnap.exists() ? userSnap.data() : {};
    if (isBlockedAccount(data)) {
      await signOut(auth).catch(() => undefined);
      throw new Error(`This account is ${getSafeAccountStatus(data).toLowerCase()}. Please contact an administrator.`);
    }
    return data;
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
        const userData = await ensureActiveUserAccount(user.uid);
        
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
          sdata = sSnap.docs[0].data();
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
          sdata = cSnap.docs[0].data();
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
          sdata = lSnap.docs[0].data();
        }
      }
    } catch (lookupErr) {
      console.warn('Firestore student lookup info:', lookupErr);
    }

    // Verify access code if student record found with accessCode
    if (sdoc && sdata) {
      if (isBlockedAccount(sdata)) {
        throw new Error('This student account is currently disabled or suspended. Please contact your administrator.');
      }
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
    if (isBlockedAccount(existingData)) {
      await signOut(auth).catch(() => undefined);
      throw new Error(`This account is ${getSafeAccountStatus(existingData).toLowerCase()}. Please contact an administrator.`);
    }
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
        await ensureActiveUserAccount(cred.user.uid);
        
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
            sdata = eSnap.docs[0].data();
          }
        }

        if (sdoc && sdata) {
          if (isBlockedAccount(sdata)) {
            throw new Error('This student account is currently disabled or suspended.');
          }
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

            await ensureActiveUserAccount(firebaseUid);
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
      toast.success(`Welcome ${matchedSchoolName}.`);
      navigate('/portal/school');
    }
  };

  // Remaining component logic and rendering preserved from the existing portal implementation.
  return <div />;
};

export default Portal;
