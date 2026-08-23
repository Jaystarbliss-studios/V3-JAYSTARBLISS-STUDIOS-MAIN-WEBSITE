const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Login.tsx', 'utf8');

const imports = `import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';\nimport { db } from '../../lib/firebase';`;
code = code.replace(`import { auth } from '../../lib/firebase';`, `import { auth } from '../../lib/firebase';\n${imports}`);

const handleGoogle = `
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userSnap = await getDoc(doc(db, 'users', user.uid));

      if (!userSnap.exists()) {
        let userRole = 'USER';
        // Check for pending invite
        const invitesRef = collection(db, 'invites');
        const q = query(invitesRef, where('email', '==', user.email?.toLowerCase() || ''));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
           const inviteDoc = querySnapshot.docs[0];
           userRole = inviteDoc.data().role;
           await deleteDoc(inviteDoc.ref);
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
        const role = (userData.role || '').toUpperCase();
        if (!role.includes('ADMIN')) {
          throw new Error('This account does not have admin privileges.');
        }
      }

      success('Successfully logged in!');
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      showError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };
`;

code = code.replace(/  const handleGoogleLogin = async \(\) => \{[\s\S]*?  \};/, handleGoogle.trim());

fs.writeFileSync('src/pages/admin/Login.tsx', code);
