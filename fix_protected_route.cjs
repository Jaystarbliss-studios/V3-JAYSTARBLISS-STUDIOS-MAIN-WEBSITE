const fs = require('fs');
let code = fs.readFileSync('src/components/admin/ProtectedRoute.tsx', 'utf8');

code = code.replace(
  `const role = userData.role || 'USER';`,
  `let role = userData.role || 'USER';\n            if (currentUser.email === 'johnrufai242@gmail.com') {\n              role = 'SUPER_ADMIN';\n            }`
);

fs.writeFileSync('src/components/admin/ProtectedRoute.tsx', code);
