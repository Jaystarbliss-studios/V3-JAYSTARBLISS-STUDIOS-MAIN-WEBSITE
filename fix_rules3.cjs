const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

const newRules = `
    match /parents/{userId} {
      allow read: if isAuth() && (request.auth.uid == userId || isAnyAdmin());
      allow create: if isAuth() && request.auth.uid == userId;
      allow update: if isAuth() && (request.auth.uid == userId || isAnyAdmin());
    }

    match /students/{studentId} {
      allow read: if isAuth() && (
        isAnyAdmin() ||
        (hasRole('PARENT') && resource.data.parentId == request.auth.token.email) ||
        (hasRole('STUDENT') && request.auth.token.email == resource.data.email) ||
        hasAnyRole(['STAFF', 'TUTOR'])
      );
      allow write: if isAnyAdmin();
    }

    match /student_requests/{requestId} {
      allow create: if true;
      allow read, update, delete: if isAnyAdmin();
    }
    
    match /tutor_applications/{appId} {
      allow create: if true;
      allow read, update, delete: if isAnyAdmin();
    }
    
    match /enrollment_requests/{reqId} {
      allow create: if true;
      allow read, update, delete: if isAnyAdmin();
    }
    
    match /staffGeneralResources/{resId} {
      allow read: if hasAnyRole(['STAFF', 'TUTOR', 'SUPER_ADMIN', 'CONTENT_ADMIN', 'EDUCATION_ADMIN']);
      allow write: if isContentAdmin() || isEducationAdmin();
    }
`;

code = code.replace(/    \/\/ ==========================================\n    \/\/ INQUIRIES & FORMS/, newRules.trim() + '\n\n    // ==========================================\n    // INQUIRIES & FORMS');

fs.writeFileSync('firestore.rules', code);
