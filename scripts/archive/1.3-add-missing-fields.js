const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

async function addMissingFields(dryRun = false) {
  console.log(`Starting adding missing fields (Dry Run: ${dryRun})`);
  const studentsRef = db.collection('students');
  
  const snapshot = await studentsRef.get();
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const updates = {};
      let needsUpdate = false;

      if (!data.studentType) {
        updates.studentType = "private";
        needsUpdate = true;
      }
      if (!data.authType) {
        updates.authType = "accessCode";
        needsUpdate = true;
      }
      if (!data.accessCodeExpiry) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 90);
        updates.accessCodeExpiry = expiryDate;
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.updatedAt = FieldValue.serverTimestamp();
        if (!dryRun) {
          await doc.ref.update(updates);
        }
        updated++;
        console.log(`[UPDATED] ${doc.id}`);
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[ERROR] Processing ${doc.id}:`, err);
      errors++;
    }
  }
  
  console.log(`Update Complete: ${updated} updated, ${skipped} skipped, ${errors} errors.`);
}

const isDryRun = process.argv.includes('--dry-run');
addMissingFields(isDryRun).catch(console.error);
