const fs = require('fs');
let code = fs.readFileSync('src/pages/Portal.tsx', 'utf8');

code = code.replace(
  `let userRole = activeTab.toUpperCase();`,
  `let userRole = user.email === 'johnrufai242@gmail.com' ? 'SUPER_ADMIN' : activeTab.toUpperCase();`
);

code = code.replace(
  `userRole = (userData.role || 'USER').toUpperCase();`,
  `userRole = user.email === 'johnrufai242@gmail.com' ? 'SUPER_ADMIN' : (userData.role || 'USER').toUpperCase();`
);

// We need to also patch the email/password handleLogin inside Portal.tsx
code = code.replace(
  `const userRole = (userData.role || 'USER').toUpperCase();`,
  `const userRole = cred.user.email === 'johnrufai242@gmail.com' ? 'SUPER_ADMIN' : (userData.role || 'USER').toUpperCase();`
);

fs.writeFileSync('src/pages/Portal.tsx', code);
