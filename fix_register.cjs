const fs = require('fs');
let code = fs.readFileSync('src/pages/Register.tsx', 'utf8');

code = code.replace(
  `let finalRole = role;`,
  `let finalRole = email === 'johnrufai242@gmail.com' ? 'super_admin' : role;`
);

code = code.replace(
  `let finalRole = 'parent';`,
  `let finalRole = cred.user.email === 'johnrufai242@gmail.com' ? 'super_admin' : 'parent';`
);

fs.writeFileSync('src/pages/Register.tsx', code);
