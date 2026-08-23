const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

async function migrateIndividualStudents(dryRun = false) {
  console.log(`Starting migration (Dry Run: ${dryRun})`);
  const individualRef = db.collection('individualStudents');
  const studentsRef = db.collection('students');
  
  const snapshot = await individualRef.get();
  let created = 0;
  let merged = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const email = data.email || data.parentEmail || `${doc.id}@noemail.com`;
      
      const targetQuery = await studentsRef.where('email', '==', email).limit(1).get();
      
      const mappedData = {
        uid: data.uid || null,
        name: data.fullName || data.name || 'Unknown',
        email: email,
        accessCode: data.accessCode || '',
        accessCodeExpiry: data.accessCodeExpiry || FieldValue.serverTimestamp(),
        studentType: "private",
        schoolId: null,
        parentId: data.parentId || null,
        authType: "accessCode",
        subjects: data.subjects || [],
        role: "student",
        createdAt: data.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      if (targetQuery.empty) {
        if (!dryRun) {
          await studentsRef.add(mappedData);
        }
        created++;
        console.log(`[CREATED] ${email}`);
      } else {
        const targetDoc = targetQuery.docs[0];
        const existingData = targetDoc.data();
        const mergedData = { ...mappedData, ...existingData, updatedAt: FieldValue.serverTimestamp() };
        
        if (!dryRun) {
          await targetDoc.ref.set(mergedData, { merge: true });
        }
        merged++;
        console.log(`[MERGED] ${email}`);
      }
    } catch (err) {
      console.error(`[ERROR] Processing ${doc.id}:`, err);
      errors++;
    }
  }
  
  console.log(`Migration Complete: ${created} created, ${merged} merged, ${skipped} skipped, ${errors} errors.`);
}

const isDryRun = process.argv.includes('--dry-run');
migrateIndividualStudents(isDryRun).catch(console.error);
