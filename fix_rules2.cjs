const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

const newUsersRule = `
    match /users/{userId} {
      allow read: if isAuth() && (request.auth.uid == userId || isAnyAdmin());
      allow create: if isAuth() && request.auth.uid == userId && (
        !(request.resource.data.role in ['SUPER_ADMIN', 'CONTENT_ADMIN', 'EDUCATION_ADMIN', 'SERVICES_ADMIN', 'MARKETING_ADMIN', 'SUPPORT_ADMIN', 'ADMIN']) ||
        request.auth.token.email == 'johnrufai242@gmail.com' ||
        (exists(/databases/$(database)/documents/invites/$(request.auth.token.email.lower())))
      );
      // Prevent users from escalating their own privileges
      allow update: if isAuth() && (
        isSuperAdmin() || 
        (request.auth.uid == userId && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'])))
      );
      allow delete: if isSuperAdmin();
    }
`;

code = code.replace(/    match \/users\/\{userId\} \{[\s\S]*?allow delete: if isSuperAdmin\(\);\n    \}/, newUsersRule.trim());

fs.writeFileSync('firestore.rules', code);
