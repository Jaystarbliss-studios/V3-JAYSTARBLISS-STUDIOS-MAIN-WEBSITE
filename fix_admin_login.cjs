const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Login.tsx', 'utf8');

code = code.replace(
  `let userRole = 'USER';`,
  `let userRole = user.email === 'johnrufai242@gmail.com' ? 'SUPER_ADMIN' : 'USER';`
);

code = code.replace(
  `const role = (userData.role || '').toUpperCase();`,
  `const role = user.email === 'johnrufai242@gmail.com' ? 'SUPER_ADMIN' : (userData.role || '').toUpperCase();`
);

// We should also patch handleLogin to allow email/password login to get in if they are johnrufai242@gmail.com.
code = code.replace(
  `await signInWithEmailAndPassword(auth, email, password);`,
  `const cred = await signInWithEmailAndPassword(auth, email, password);\n      if (cred.user.email !== 'johnrufai242@gmail.com') {\n        const userSnap = await getDoc(doc(db, 'users', cred.user.uid));\n        const role = userSnap.exists() ? (userSnap.data().role || '').toUpperCase() : '';\n        if (!role.includes('ADMIN')) throw new Error('This account does not have admin privileges.');\n      }`
);

fs.writeFileSync('src/pages/admin/Login.tsx', code);
