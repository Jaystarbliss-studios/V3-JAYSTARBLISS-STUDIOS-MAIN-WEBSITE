import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Read config
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function migrateProgress() {
  console.log("Starting progress schema migration...");
  const progressRef = collection(db, 'progress');
  const snap = await getDocs(progressRef);
  
  let count = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    
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
    if (data.updatedAt === undefined) updateData.updatedAt = serverTimestamp();

    if (Object.keys(updateData).length > 0) {
      await updateDoc(doc(db, 'progress', docSnap.id), updateData);
      count++;
    }
  }
  console.log(`Migrated ${count} progress documents.`);
}

migrateProgress().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
