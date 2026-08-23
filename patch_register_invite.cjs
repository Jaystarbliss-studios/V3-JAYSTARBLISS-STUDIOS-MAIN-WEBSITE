const fs = require('fs');
let code = fs.readFileSync('src/pages/Register.tsx', 'utf8');

const imports = `import { collection, addDoc, doc, setDoc, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';`;
code = code.replace(`import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';`, imports);

const signupLogic = `
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        
        let finalRole = mode;
        try {
          const invitesRef = collection(db, 'invites');
          const q = query(invitesRef, where('email', '==', email.toLowerCase()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
             const inviteDoc = querySnapshot.docs[0];
             finalRole = inviteDoc.data().role.toLowerCase();
             await deleteDoc(inviteDoc.ref);
          }
        } catch(e) {
          console.error(e);
        }
        
        const data = {
          name: fullName,
          email: email.toLowerCase(),
          phone,
          role: finalRole,
          children: [],
          emailVerified: false,
          createdAt: serverTimestamp()
        };
`;

code = code.replace(/        const cred = await createUserWithEmailAndPassword\(auth, email, password\);\s*await sendEmailVerification\(cred\.user\);\s*const data = \{[\s\S]*?createdAt: serverTimestamp\(\)\s*\};/, signupLogic.trim());

// Wait, there's another createUserWithEmailAndPassword block if mode is 'student' (or maybe not? let's see). Let's just do a regex replace to catch it.
fs.writeFileSync('src/pages/Register.tsx', code);
