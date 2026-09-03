import type { Handler } from "@netlify/functions";
import type { Firestore, DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const normalizeUsername = (value: string) => value.toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
const isBlocked = (data: Record<string, any>) => ["SUSPENDED", "BANNED"].includes(String(data.accountStatus || data.status || "ACTIVE").toUpperCase());

async function findStudent(identifier: string, db: Firestore): Promise<DocumentSnapshot | QueryDocumentSnapshot | null> {
  const raw = identifier.trim();
  const email = raw.toLowerCase();
  const username = normalizeUsername(raw);
  const byUsername = await db.collection("individualStudents").where("username", "==", username).limit(1).get();
  if (!byUsername.empty) return byUsername.docs[0];
  if (email.includes("@")) {
    const byEmail = await db.collection("individualStudents").where("email", "==", email).limit(1).get();
    if (!byEmail.empty) return byEmail.docs[0];
  }
  const byCode = await db.collection("individualStudents").where("accessCode", "==", raw.toUpperCase()).limit(1).get();
  if (!byCode.empty) return byCode.docs[0];
  const byId = await db.collection("individualStudents").doc(raw).get();
  if (byId.exists) return byId;
  if (email.includes("@")) {
    const legacy = await db.collection("students").where("email", "==", email).limit(1).get();
    if (!legacy.empty) return legacy.docs[0];
  }
  return null;
}

async function getOrCreateUid(email: string | undefined, displayName: string, preferredUid: string) {
  try { await adminAuth.getUser(preferredUid); return preferredUid; } catch {}
  if (email) {
    try { return (await adminAuth.getUserByEmail(email)).uid; } catch {}
  }
  const syntheticEmail = `${preferredUid}@jdh-portal.local`;
  return (await adminAuth.createUser({ uid: preferredUid, email: email || syntheticEmail, displayName })).uid;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const body = JSON.parse(event.body || "{}");
    const role = String(body.role || "").toLowerCase();
    const identifier = String(body.identifier || "").trim();
    const code = String(body.code || "").trim();
    if (!["student", "school"].includes(role) || !identifier || !code || code.length > 128) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid login request." }) };
    }

    if (role === "student") {
      const snap = await findStudent(identifier, adminDb);
      if (!snap) return { statusCode: 401, body: JSON.stringify({ error: "Invalid student credentials." }) };
      const profile = snap.data() || {};
      const storedCode = String(profile.accessCode || profile.passcode || "").trim().toUpperCase();
      if (!storedCode || storedCode !== code.toUpperCase() || isBlocked(profile)) {
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid student credentials." }) };
      }

      const email = typeof profile.email === "string" && profile.email.includes("@") ? profile.email.toLowerCase() : undefined;
      const uid = await getOrCreateUid(email, String(profile.fullName || profile.studentName || profile.username || "Student"), String(profile.firebaseUid || `student_${snap.id}`));
      const authEmail = (await adminAuth.getUser(uid)).email || null;
      const schoolId = String(profile.schoolId || "");

      await snap.ref.set({ firebaseUid: uid, authEmail }, { merge: true });
      await adminDb.collection("users").doc(uid).set({
        email: authEmail,
        name: profile.fullName || profile.studentName || profile.username || "Student",
        role: "student",
        studentDocId: snap.id,
        schoolId,
        schoolName: profile.schoolName || "",
        updatedAt: new Date()
      }, { merge: true });

      const customToken = await adminAuth.createCustomToken(uid, { role: "student", schoolId });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customToken,
          role: "student",
          studentDocId: snap.id,
          name: profile.fullName || profile.studentName || profile.username || "Student",
          username: profile.username || "",
          class: profile.class || profile.grade || "",
          schoolId,
          schoolName: profile.schoolName || ""
        })
      };
    }

    const raw = identifier;
    let schoolSnap: QueryDocumentSnapshot | DocumentSnapshot | null = null;
    if (raw.includes("@")) {
      const q = await adminDb.collection("schools").where("email", "==", raw.toLowerCase()).limit(1).get();
      if (!q.empty) schoolSnap = q.docs[0];
    }
    if (!schoolSnap) {
      const d = await adminDb.collection("schools").doc(raw).get();
      if (d.exists) schoolSnap = d;
    }
    if (!schoolSnap) {
      const q = await adminDb.collection("schools").where("schoolId", "==", raw).limit(1).get();
      if (!q.empty) schoolSnap = q.docs[0];
    }
    if (!schoolSnap) {
      const q = await adminDb.collection("schools").where("accessCode", "==", raw.toUpperCase()).limit(1).get();
      if (!q.empty) schoolSnap = q.docs[0];
    }
    if (!schoolSnap) return { statusCode: 401, body: JSON.stringify({ error: "Invalid school credentials." }) };

    const profile = schoolSnap.data() || {};
    const storedCode = String(profile.accessCode || "").trim().toUpperCase();
    if (!storedCode || (storedCode !== code.toUpperCase() && storedCode !== raw.toUpperCase()) || isBlocked(profile)) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid school credentials." }) };
    }

    const email = typeof profile.email === "string" && profile.email.includes("@") ? profile.email.toLowerCase() : undefined;
    const uid = await getOrCreateUid(email, String(profile.name || "Partner School"), String(profile.adminUid || profile.userId || `school_${schoolSnap.id}`));
    const authEmail = (await adminAuth.getUser(uid)).email || null;
    await adminDb.collection("users").doc(uid).set({
      email: authEmail,
      name: profile.name || "Partner School",
      role: "school",
      schoolId: schoolSnap.id,
      schoolName: profile.name || "",
      updatedAt: new Date()
    }, { merge: true });

    const customToken = await adminAuth.createCustomToken(uid, { role: "school", schoolId: schoolSnap.id });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customToken, role: "school", schoolDocId: schoolSnap.id, schoolId: schoolSnap.id, name: profile.name || "Partner School" })
    };
  } catch (error) {
    console.error("Portal access login error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to complete portal login." }) };
  }
};
