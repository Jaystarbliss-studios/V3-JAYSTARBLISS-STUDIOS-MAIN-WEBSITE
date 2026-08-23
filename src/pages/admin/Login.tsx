import React, { useState } from 'react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import SEO from '../../components/ui/SEO';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      const user = result.user;
      const userSnap = await getDoc(doc(db, 'users', user.uid));

      if (!userSnap.exists()) {
        let userRole = user.email === 'johnrufai242@gmail.com' ? 'SUPER_ADMIN' : 'USER';
        // Check for pending invite
        const inviteDocRef = doc(db, 'invites', (user.email || '').toLowerCase());
        const inviteSnap = await getDoc(inviteDocRef);
        
        if (inviteSnap.exists()) {
           userRole = inviteSnap.data().role;
           await deleteDoc(inviteDocRef);
        }

        // Auto-create for first-time Google sign-in
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          name: user.displayName || '',
          role: userRole,
          createdAt: serverTimestamp()
        });
        
        // Wait, if they just got created and their role is not Admin, should we let them into /admin?
        // ProtectedRoute will kick them out anyway if not authorized, but let's check here
        if (!userRole.includes('ADMIN')) {
          throw new Error('This account does not have admin privileges.');
        }
      } else {
        const userData = userSnap.data();
        const role = user.email === 'johnrufai242@gmail.com' ? 'SUPER_ADMIN' : (userData.role || '').toUpperCase();
        if (!role.includes('ADMIN')) {
          throw new Error('This account does not have admin privileges.');
        }
      }

      sessionStorage.setItem('userRole', 'super_admin');
      sessionStorage.setItem('userId', user.uid);
      sessionStorage.setItem('userEmail', user.email || '');
      sessionStorage.setItem('userName', user.displayName || 'Admin');
      localStorage.setItem('jaystar_cached_user_role', 'super_admin');
      localStorage.setItem('jaystar_cached_user_id', user.uid);
      localStorage.setItem('jaystar_cached_user_name', user.displayName || 'Admin');

      success('Successfully logged in!');
      navigate('/admin');
    } catch (err: any) {
      console.error('Admin Google sign in error:', err);
      let msg = err.message || 'Google sign-in failed';
      if (err.code === 'auth/popup-closed-by-user') msg = 'Sign-in popup was closed.';
      else if (err.code === 'auth/popup-blocked') msg = 'Popup was blocked by browser. Please allow popups or use email login.';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      showError('Please enter your email address.');
      return;
    }

    if (password.length < 6) {
      const msg = 'Password should be at least 6 characters.';
      setError(msg);
      showError(msg);
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      let detectedName = cred.user.displayName || 'Admin';
      if (cred.user.email !== 'johnrufai242@gmail.com') {
        const userSnap = await getDoc(doc(db, 'users', cred.user.uid));
        const role = userSnap.exists() ? (userSnap.data().role || '').toUpperCase() : '';
        if (!role.includes('ADMIN')) throw new Error('This account does not have admin privileges.');
        if (userSnap.exists() && userSnap.data().name) detectedName = userSnap.data().name;
      }

      sessionStorage.setItem('userRole', 'super_admin');
      sessionStorage.setItem('userId', cred.user.uid);
      sessionStorage.setItem('userEmail', cred.user.email || '');
      sessionStorage.setItem('userName', detectedName);
      localStorage.setItem('jaystar_cached_user_role', 'super_admin');
      localStorage.setItem('jaystar_cached_user_id', cred.user.uid);
      localStorage.setItem('jaystar_cached_user_name', detectedName);

      success('Successfully logged in!');
      navigate('/admin');
    } catch (err: any) {
      let msg = err.message || 'Invalid credentials';
      if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-login-credentials') {
        msg = 'Invalid email or password. Please check your credentials.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <SEO 
        title="Admin Console Login" 
        description="Administrative access to Jaystarbliss Studios content management portal." 
        noindex={true}
      />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-brand-slate rounded-xl flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">Admin Login</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 dark:border-slate-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-red focus:border-brand-red sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-red focus:border-brand-red sm:text-sm" />
            </div>
            <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign in'}
            </button>
          </form>
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-slate-900 text-gray-500">Or continue with</span>
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-700"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
              </div>
            </div>

        </div>
      </div>
    </div>
  );
};
export default Login;
