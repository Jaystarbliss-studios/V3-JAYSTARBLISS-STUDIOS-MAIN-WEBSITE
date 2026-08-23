const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize with Application Default Credentials
initializeApp();

const db = getFirestore();

async function runAudit() {
  console.log('--- STARTING AUDIT ---');
  
  const studentsSnap = await db.collection('students').get();
  const individualSnap = await db.collection('individualStudents').get();

  console.log(`\nTotal records in /students: ${studentsSnap.size}`);
  console.log(`Total records in /individualStudents: ${individualSnap.size}`);

  const studentsFields = new Set();
  studentsSnap.forEach(doc => {
    Object.keys(doc.data()).forEach(key => studentsFields.add(key));
  });

  const individualFields = new Set();
  individualSnap.forEach(doc => {
    Object.keys(doc.data()).forEach(key => individualFields.add(key));
  });

  console.log('\n--- FIELD COMPARISON ---');
  console.log('Fields present in /students:', Array.from(studentsFields).join(', ') || '(none)');
  console.log('Fields present in /individualStudents:', Array.from(individualFields).join(', ') || '(none)');
  
  console.log('\n--- SCHEMA MISMATCHES EXPECTED (Based on Migration Plan) ---');
  console.log('Legacy /individualStudents fields to deprecate: fullName, username');
  console.log('Target /students fields to ensure: uid, name, email, accessCode, accessCodeExpiry, studentType, schoolId, parentId, authType, subjects, role, createdAt, updatedAt');
  
  console.log('\n--- AUDIT COMPLETE ---');
}

runAudit().catch(console.error);
