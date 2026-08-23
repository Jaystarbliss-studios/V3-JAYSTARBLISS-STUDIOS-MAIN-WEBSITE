const fs = require('fs');

// 1. AdminUsers.tsx
let adminUsers = fs.readFileSync('src/pages/admin/AdminUsers.tsx', 'utf8');
adminUsers = adminUsers.replace('import { collection, getDocs, doc, updateDoc, addDoc, query, where }', 'import { collection, getDocs, doc, updateDoc, setDoc }');
adminUsers = adminUsers.replace(/const handleInviteUser = async/, 'const handleInvite = async');
adminUsers = adminUsers.replace(/await addDoc\(collection\(db, 'invites'\), \{[\s\S]*?createdAt: new Date\(\)\.toISOString\(\)\s*\}\);/, `await setDoc(doc(db, 'invites', inviteEmail.toLowerCase()), {
        email: inviteEmail.toLowerCase(),
        name: inviteName,
        role: inviteRole,
        createdAt: new Date().toISOString()
      });`);
fs.writeFileSync('src/pages/admin/AdminUsers.tsx', adminUsers);

// 2. Portal.tsx
let portal = fs.readFileSync('src/pages/Portal.tsx', 'utf8');
portal = portal.replace('import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc }', 'import { doc, getDoc, setDoc, serverTimestamp, deleteDoc }');
const portalInviteCheck = `
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
`;
const newPortalInviteCheck = `
        // Check for pending invite
        const inviteDocRef = doc(db, 'invites', (user.email || '').toLowerCase());
        const inviteSnap = await getDoc(inviteDocRef);
        
        if (inviteSnap.exists()) {
           userRole = inviteSnap.data().role;
           await deleteDoc(inviteDocRef);
        }
`;
portal = portal.replace(portalInviteCheck.trim(), newPortalInviteCheck.trim());
fs.writeFileSync('src/pages/Portal.tsx', portal);

// 3. Register.tsx
let register = fs.readFileSync('src/pages/Register.tsx', 'utf8');
register = register.replace('import { collection, addDoc, doc, setDoc, serverTimestamp, query, where, getDocs, deleteDoc }', 'import { collection, addDoc, doc, setDoc, serverTimestamp, getDoc, deleteDoc }');
const registerInviteCheck = `
          const invitesRef = collection(db, 'invites');
          const q = query(invitesRef, where('email', '==', email.toLowerCase()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
             const inviteDoc = querySnapshot.docs[0];
             finalRole = inviteDoc.data().role.toLowerCase();
             await deleteDoc(inviteDoc.ref);
          }
`;
const newRegisterInviteCheck = `
          const inviteDocRef = doc(db, 'invites', email.toLowerCase());
          const inviteSnap = await getDoc(inviteDocRef);
          if (inviteSnap.exists()) {
             finalRole = inviteSnap.data().role.toLowerCase();
             await deleteDoc(inviteDocRef);
          }
`;
register = register.replace(registerInviteCheck.trim(), newRegisterInviteCheck.trim());
fs.writeFileSync('src/pages/Register.tsx', register);

// 4. admin/Login.tsx
let adminLogin = fs.readFileSync('src/pages/admin/Login.tsx', 'utf8');
adminLogin = adminLogin.replace('import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc }', 'import { doc, getDoc, setDoc, serverTimestamp, deleteDoc }');
const adminLoginInviteCheck = `
        // Check for pending invite
        const invitesRef = collection(db, 'invites');
        const q = query(invitesRef, where('email', '==', user.email?.toLowerCase() || ''));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
           const inviteDoc = querySnapshot.docs[0];
           userRole = inviteDoc.data().role;
           await deleteDoc(inviteDoc.ref);
        }
`;
const newAdminLoginInviteCheck = `
        // Check for pending invite
        const inviteDocRef = doc(db, 'invites', (user.email || '').toLowerCase());
        const inviteSnap = await getDoc(inviteDocRef);
        
        if (inviteSnap.exists()) {
           userRole = inviteSnap.data().role;
           await deleteDoc(inviteDocRef);
        }
`;
adminLogin = adminLogin.replace(adminLoginInviteCheck.trim(), newAdminLoginInviteCheck.trim());
fs.writeFileSync('src/pages/admin/Login.tsx', adminLogin);

