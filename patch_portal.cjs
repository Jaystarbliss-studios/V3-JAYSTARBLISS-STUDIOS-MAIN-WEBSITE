const fs = require('fs');
let code = fs.readFileSync('src/pages/Portal.tsx', 'utf8');

const imports = `import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';`;
code = code.replace(`import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';`, imports);

const newHandleGoogle = `
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userSnap = await getDoc(doc(db, 'users', user.uid));

      let userRole = activeTab.toUpperCase();

      if (!userSnap.exists()) {
        // Check for pending invite
        const invitesRef = collection(db, 'invites');
        const q = query(invitesRef, where('email', '==', user.email?.toLowerCase() || ''));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
           const inviteDoc = querySnapshot.docs[0];
           userRole = inviteDoc.data().role;
           // Optionally delete the invite here, but keeping it as a record is fine too.
           await deleteDoc(inviteDoc.ref);
        }

        // Auto-create for first-time Google sign-in
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          name: user.displayName || '',
          role: userRole,
          createdAt: serverTimestamp()
        });
      } else {
        const userData = userSnap.data();
        userRole = (userData.role || 'USER').toUpperCase();
      }

      const expectedRole = activeTab.toUpperCase();

      if (userRole.includes('ADMIN')) {
         navigate('/admin');
         return;
      }

      const isStaffTab = expectedRole === 'STAFF';
      const isStaffUser = userRole === 'STAFF' || userRole === 'TUTOR';

      if (userRole !== expectedRole && !(isStaffTab && isStaffUser)) {
         throw new Error(\`This account belongs to a \${userRole || 'USER'}. Please switch tabs.\`);
      }
      
      navigate(\`/portal/\${activeTab}\`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };
`;

code = code.replace(/  const handleGoogleLogin = async \(\) => \{[\s\S]*?  \};/, newHandleGoogle.trim());

fs.writeFileSync('src/pages/Portal.tsx', code);
