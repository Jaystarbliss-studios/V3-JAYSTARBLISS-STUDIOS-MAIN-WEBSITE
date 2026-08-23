// Migration script for progress collection (Phase A)
// Note: To run this locally, ensure you have appropriate permissions or run via Firebase Functions.
const admin = require('firebase-admin');

async function migrateProgress(db) {
  console.log("Starting progress schema migration...");
  const progressRef = db.collection('progress');
  const snap = await progressRef.get();
  
  let count = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    
    // Add missing fields if not present
    const updateData = {};
    if (data.programmeTitle === undefined) updateData.programmeTitle = "";
    if (data.programmeOutline === undefined) updateData.programmeOutline = "";
    if (data.programmeObjectives === undefined) updateData.programmeObjectives = [];
    if (data.completionPercentage === undefined) updateData.completionPercentage = 0;
    if (data.performanceScore === undefined) updateData.performanceScore = 0;
    if (data.checklistItems === undefined) updateData.checklistItems = [];
    if (data.sessionHistory === undefined) updateData.sessionHistory = [];
    if (data.certificateIssued === undefined) updateData.certificateIssued = false;
    if (data.certificateIssuedAt === undefined) updateData.certificateIssuedAt = null;
    if (data.programmeApprovedByAdmin === undefined) updateData.programmeApprovedByAdmin = false;
    if (data.programmeSubmittedAt === undefined) updateData.programmeSubmittedAt = null;
    if (data.updatedAt === undefined) updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    if (Object.keys(updateData).length > 0) {
      await docSnap.ref.update(updateData);
      count++;
    }
  }
  console.log(`Migrated ${count} progress documents.`);
}

module.exports = migrateProgress;

if (require.main === module) {
  // If running directly, initialize admin SDK
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  migrateProgress(admin.firestore()).then(() => process.exit(0)).catch(console.error);
}
