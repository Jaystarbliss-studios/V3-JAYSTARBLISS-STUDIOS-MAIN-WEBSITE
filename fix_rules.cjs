const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

const newUsersRule = `
    match /users/{userId} {
      allow read: if isAuth() && (request.auth.uid == userId || isAnyAdmin());
      allow create: if isAuth() && request.auth.uid == userId;
      // Prevent users from escalating their own privileges
      allow update: if isAuth() && (
        isSuperAdmin() || 
        (request.auth.uid == userId && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'])))
      );
      allow delete: if isSuperAdmin();
    }
`;

code = code.replace(/    match \/users\/\{userId\} \{[\s\S]*?allow delete: if isSuperAdmin\(\);\n    \}/, newUsersRule.trim());

const invitesRule = `
    match /invites/{email} {
      allow read: if true;
      allow write: if isSuperAdmin();
      allow delete: if isAuth() && request.auth.token.email != null && request.auth.token.email.toLowerCase() == email;
    }
`;

// Insert after admins collection
code = code.replace(/    match \/admins\/\{userId\} \{[\s\S]*?    \}/, `$&` + '\n' + invitesRule);

fs.writeFileSync('firestore.rules', code);
