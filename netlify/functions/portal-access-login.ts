import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const normalizeUsername = (value: string) => value.toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
const isBlocked = (data: Record<string, any>) => ["SUSPENDED", "BANNED"].includes(String(data.accountStatus || data.status || "ACTIVE").toUpperCase());

async function findStudent(identifier: string, db: FirebaseFirestore.Firestore) {
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
  try {
    const byId = await db.collection("individualStudents").doc(raw).get();
    if (byId.exists) return byId;
  } catch {}
  if (email.includes("@")) {
    const legacy = await db.collection("students").where("email", "==", email).limit(1).get();
    if (!legacy.empty) return legacy.docs[0];
  }
  return null;
}

async function getOrCreateUid(email: string | undefined, displayName: string, preferredUid?: string) {
  if (preferredUid) {
    try { await adminAuth.getUser(preferredUid); return preferredUid; } catch {}
  }
  if (email) {
    try { return (await adminAuth.getUserByEmail(email)).uid; } catch {}
  }
  const syntheticEmail = `portal-${Math.random().toString(36).slice(2, 12)}@${email ? "jdh-student.local" : "jdh-portal.local"}`;
  return (await adminAuth.createUser({ email: email || syntheticEmail, displayName })).uid;
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

    let uid = "";
    let profile: Record<string, any> = {};
    let response: Record<string, any> = {};

    if (role === "student") {
      const snap = await findStudent(identifier, adminDb);
      if (!snap) return { statusCode: 401, body: JSON.stringify({ error: "Invalid student credentials." }) };
      profile = snap.data() || {};
      const storedCode = String(profile.accessCode || profile.passcode || "").trim().toUpperCase();
      if (!storedCode || storedCode !== code.toUpperCase() || isBlocked(profile)) {
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid student credentials." }) };
      }
      uid = await getOrCreateUid(
        typeof profile.email === "string" && profile.email.includes("@") ? profile.email.toLowerCase() : undefined,
        String(profile.fullName || profile.studentName || profile.username || "Student"),
        typeof profile.firebaseUid === "string" ? profile.firebaseUid : undefined
      );
      const schoolId = String(profile.schoolId || "");
      await snap.ref.set({ firebaseUid: uid, authEmail: (await adminAuth.getUser(uid)).email || null }, { merge: true });
      await adminDb.collection("users").doc(uid).set({
        email: (await adminAuth.getUser(uid)).email || null,
        name: profile.fullName || profile.studentName || profile.username || "Student",
        role: "student",
        studentDocId: snap.id,
        schoolId,
        schoolName: profile.schoolName || "",
        updatedAt: new Date()
      }, { merge: true });
      response = { role: "student", studentDocId: snap.id, name: profile.fullName || profile.studentName || profile.username, username: profile.username || "", class: profile.class || profile.grade || "", schoolId, schoolName: profile.schoolName || "" };
    } else {
      const raw = identifier;
      const inputCode = code.toUpperCase();
      let schoolSnap: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;
      if (raw.includes("@")) {
        const q = await adminDb.collection("schools").where("email", "==", raw.toLowerCase()).limit(1).get();
        if (!q.empty) schoolSnap = q.docs[0];
      }
      if (!schoolSnap) {
        try { const d = await adminDb.collection("schools").doc(raw).get(); if (d.exists) schoolSnap = d; } catch {}
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
      profile = schoolSnap.data() || {};
      const storedCode = String(profile.accessCode || "").trim().toUpperCase();
      if (!storedCode || (storedCode !== inputCode && storedCode !== raw.toUpperCase()) || isBlocked(profile)) {
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid school credentials." }) };
      }
      const email = typeof profile.email === "string" && profile.email.includes("@") ? profile.email.toLowerCase() : undefined;
      uid = await getOrCreateUid(email, String(profile.name || "Partner School"), String(profile.adminUid || profile.userId || "") || undefined);
      await adminDb.collection("users").doc(uid).set({
        email: email || (await adminAuth.getUser(uid)).email || null,
        name: profile.name || "Partner School",
        role: "school",
        schoolId: schoolSnap.id,
        schoolName: profile.name || "",
        updatedAt: new Date()
      }, { merge: true });
      response = { role: "school", schoolDocId: schoolSnap.id, schoolId: schoolSnap.id, name: profile.name || "Partner School" };
    }

    const customToken = await adminAuth.createCustomToken(uid, { role: response.role, schoolId: response.schoolId || "" });
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customToken, ...response }) };
  } catch (error) {
    console.error("Portal access login error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Unable to complete portal login." }) };
  }
};
