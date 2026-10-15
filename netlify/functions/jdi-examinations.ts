import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const bearer = (event: any) => { const value = event.headers?.authorization || event.headers?.Authorization || ""; return value.startsWith("Bearer ") ? value.slice(7) : ""; };
const hashCode = (salt: string, code: string) => createHash("sha256").update(salt + ":" + code).digest("hex");
const constantEqual = (a: string, b: string) => { const aa = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex"); return aa.length === bb.length && timingSafeEqual(aa, bb); };
const norm = (value: unknown) => String(value || "").trim().toUpperCase();
const staffRoles = ["TUTOR", "STAFF", "INSTRUCTOR"];
const adminRoles = ["ADMIN", "SUPER_ADMIN", "EDUCATION_ADMIN", "CONTENT_ADMIN", "DIRECTOR"];
async function caller(event: any) {
  const token = bearer(event); if (!token) throw new Error("AUTH");
  const decoded = await adminAuth.verifyIdToken(token);
  const snap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!snap.exists) throw new Error("PROFILE");
  const user = snap.data() || {};
  if (["DISABLED", "SUSPENDED", "BANNED"].includes(norm(user.accountStatus || user.status))) throw new Error("INACTIVE");
  return { uid: decoded.uid, role: norm(user.role), user };
}
async function getStudent(uid: string) {
  for (const collectionName of ["students", "individualStudents"]) { const direct = await adminDb.collection(collectionName).doc(uid).get(); if (direct.exists) return { id: direct.id, data: direct.data() || {} }; }
  for (const collectionName of ["students", "individualStudents"]) {
    const q = await adminDb.collection(collectionName).where("firebaseUid", "==", uid).limit(1).get();
    if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
    const q2 = await adminDb.collection(collectionName).where("userId", "==", uid).limit(1).get();
    if (!q2.empty) return { id: q2.docs[0].id, data: q2.docs[0].data() };
  }
  return null;
}
function studentSafe(exam: any) {
  const { passcodeHash, passcodeSalt, questions, answerKey, createdBy, ...safe } = exam;
  return { ...safe, questions: Array.isArray(questions) ? questions.map((q: any) => { const { correctOptionIds, acceptedAnswers, answer, explanation, ...studentQuestion } = q; return studentQuestion; }) : [] };
}
async function permittedSchool(callerInfo: any, schoolId: string) {
  if (adminRoles.includes(callerInfo.role) || callerInfo.role === "SUPERADMIN") return true;
  if (callerInfo.role === "SCHOOL") return String(callerInfo.user.schoolId || callerInfo.uid) === schoolId;
  if (staffRoles.includes(callerInfo.role)) {
    if (String(callerInfo.user.schoolId || callerInfo.user.school_id || "") === schoolId) return true;
    const access = await adminDb.collection("staffSchoolAccess").doc(callerInfo.uid).get();
    const data = access.data() || {};
    return data.schoolId === schoolId || (Array.isArray(data.schoolIds) && data.schoolIds.includes(schoolId));
  }
  return false;
}
export const handler: Handler = async (event) => {
  try {
    const c = await caller(event);
    const method = event.httpMethod || "GET";
    const path = String(event.path || "");
    if (method === "GET" && path.endsWith("/student-examinations")) {
      if (c.role !== "STUDENT") return json(403, { error: "Student access required." });
      const student = await getStudent(c.uid);
      if (!student) return json(200, { exams: [] });
      const schoolId = String(student.data.schoolId || student.data.school_id || student.data.schoolDocId || "");
      if (!schoolId) return json(200, { exams: [] });
      const exams = await adminDb.collection("jdiExams").where("schoolId", "==", schoolId).limit(100).get();
      const now = Date.now();
      const rows = exams.docs.map(doc => ({ id: doc.id, ...studentSafe(doc.data()) })).filter((exam: any) => {
        const classes = Array.isArray(exam.classIds) ? exam.classIds.map(String) : [String(exam.targetClass || "")];
        const classId = String(student.data.classId || student.data.class_id || student.data.classLevel || student.data.className || student.data.class || "");
        return (!classes.length || classes.includes(classId) || classes.includes("all")) && exam.status !== "draft" && exam.status !== "archived";
      }).map((exam: any) => {
        const from = exam.availableFrom ? new Date(exam.availableFrom).getTime() : 0;
        const until = exam.availableUntil ? new Date(exam.availableUntil).getTime() : Number.MAX_SAFE_INTEGER;
        const status = exam.status === "completed" || now > until ? "completed" : (now < from || exam.status === "scheduled") ? "upcoming" : exam.status === "active" ? "active" : "upcoming";
        return { ...exam, status };
      });
      const attemptsSnap = await adminDb.collection("jdiExamAttempts").where("studentId", "==", student.id).limit(200).get(); const attemptsByExam: Record<string, any> = {}; for (const attemptDoc of attemptsSnap.docs) { const a = attemptDoc.data(); const current = attemptsByExam[String(a.examId)]; if (!current || (a.startedAt?.toMillis?.() || 0) > (current.startedAtMs || 0)) attemptsByExam[String(a.examId)] = { attemptId: attemptDoc.id, attemptStatus: a.status, score: a.releasedAt ? a.score : undefined, releasedAt: a.releasedAt || undefined, startedAtMs: a.startedAt?.toMillis?.() || 0 }; } const withAttempts = rows.map((exam: any) => { const a = attemptsByExam[String(exam.id)]; if (!a) return exam; const { startedAtMs, ...safeAttempt } = a; return { ...exam, ...safeAttempt }; }); return json(200, { exams: withAttempts });
    }
    if (method === "POST" && path.endsWith("/examination-passcode")) {
      if (c.role !== "STUDENT") return json(403, { error: "Student access required." });
      if (String(event.body || "").length > 20000) return json(413, { error: "Request too large." });
      const body = JSON.parse(event.body || "{}");
      const examId = String(body.examId || "").trim(), passcode = String(body.passcode || "").trim();
      if (!examId || !passcode || passcode.length > 128) return json(400, { error: "Enter the examination passcode." });
      const student = await getStudent(c.uid);
      if (!student) return json(403, { error: "This account is not assigned to a student record." });
      const ref = adminDb.collection("jdiExams").doc(examId);
      const examSnap = await ref.get();
      if (!examSnap.exists) return json(403, { error: "The passcode could not be validated for this examination." });
      const exam = examSnap.data() || {};
      const now = Date.now();
      const from = exam.availableFrom ? new Date(exam.availableFrom).getTime() : 0;
      const until = exam.availableUntil ? new Date(exam.availableUntil).getTime() : Number.MAX_SAFE_INTEGER;
      const schoolId = String(student.data.schoolId || student.data.school_id || "");
      const classes = Array.isArray(exam.classIds) ? exam.classIds.map(String) : [String(exam.targetClass || "")];
      const classId = String(student.data.classId || student.data.classLevel || student.data.class || "");
      const assigned = exam.schoolId === schoolId && (!classes.length || classes.includes(classId) || classes.includes("all"));
      const active = exam.status === "active" && now >= from && now <= until;
      const validHash = typeof exam.passcodeHash === "string" && typeof exam.passcodeSalt === "string";
      const candidate = validHash ? hashCode(exam.passcodeSalt, passcode) : "";
      const validCode = validHash && constantEqual(candidate, exam.passcodeHash);
      const throttleRef = adminDb.collection("jdiPasscodeAttempts").doc(c.uid + "_" + examId); const throttleDecision = await adminDb.runTransaction(async tx => { const snap = await tx.get(throttleRef); const data = snap.data() || {}; const nowMs = Date.now(); const oldStart = Number(data.windowStart || 0); const count = nowMs - oldStart > 15 * 60 * 1000 ? 0 : Number(data.failedCount || 0); if (count >= 5) return { blocked: true }; if (!validCode) { tx.set(throttleRef, { windowStart: count === 0 ? nowMs : oldStart || nowMs, failedCount: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); } else if (assigned && active && snap.exists) tx.delete(throttleRef); return { blocked: false }; });
      if (throttleDecision.blocked) return json(429, { error: "Too many incorrect attempts. Wait 15 minutes before trying again." });
      if (!assigned || !active || !validCode) return json(403, { error: "The passcode could not be validated for this examination." });
      const attemptId = createHash("sha256").update(examId + ":" + student.id).digest("hex"); const attemptRef = adminDb.collection("jdiExamAttempts").doc(attemptId); const prior = await attemptRef.get();
      if (prior.exists && ["submitted", "expired", "graded"].includes(String(prior.data()?.status))) return json(409, { error: "An attempt for this examination has already been submitted." });
      if (prior.exists && prior.data()?.status === "in_progress" && prior.data()?.studentUid === c.uid) return json(200, { attemptId, resumed: true });
      const duration = Math.min(300, Math.max(1, Number(exam.durationMinutes || 30)));
      const attempt = { examId, studentId: student.id, studentUid: c.uid, schoolId, status: "in_progress", startedAt: FieldValue.serverTimestamp(), deadlineAt: new Date(now + duration * 60000).toISOString(), answers: {}, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }; let resumed = false;
      await adminDb.runTransaction(async tx => {
        const existingSnap = await tx.get(attemptRef); const existingExam = await tx.get(ref);
        if (!existingExam.exists || existingExam.data()?.status !== "active") throw new Error("INACTIVE_EXAM");
        if (existingSnap.exists) { if (existingSnap.data()?.status === "in_progress" && existingSnap.data()?.studentUid === c.uid) { resumed = true; return; } throw new Error("ATTEMPT_EXISTS"); }
        tx.create(attemptRef, attempt);
      });
      return json(200, { attemptId: attemptRef.id, resumed });
    }
    if (method === "GET" && path.endsWith("/tutor-examinations")) {
      if (!staffRoles.includes(c.role) && !adminRoles.includes(c.role) && c.role !== "SCHOOL") return json(403, { error: "Not authorised." });
      const schoolId = String(event.queryStringParameters?.schoolId || c.user.schoolId || "");
      if (!schoolId || !(await permittedSchool(c, schoolId))) return json(403, { error: "You do not have access to this school." });
      const exams = await adminDb.collection("jdiExams").where("schoolId", "==", schoolId).limit(100).get();
      return json(200, { exams: exams.docs.map(d => ({ id: d.id, ...studentSafe(d.data()) })) });
    }
    if (method === "POST" && path.endsWith("/tutor-examinations")) {
      if (String(event.body || "").length > 500000) return json(413, { error: "Examination draft is too large." });
      if (!staffRoles.includes(c.role) && !adminRoles.includes(c.role) && c.role !== "SCHOOL") return json(403, { error: "Not authorised." });
      const body = JSON.parse(event.body || "{}");
      const schoolId = String(body.schoolId || c.user.schoolId || "").trim();
      if (!schoolId || !(await permittedSchool(c, schoolId))) return json(403, { error: "You do not have access to this school." });
      const title = String(body.title || "").trim(), subject = String(body.subject || "").trim();
      const questions = Array.isArray(body.questions) ? body.questions : [];
      const durationMinutes = Number(body.durationMinutes || 30);
      if (!title || !subject || !questions.length || questions.length > 200 || !Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 300) return json(400, { error: "Provide a title, subject, 1–200 questions and a duration from 1 to 300 minutes." });
      const allowedTypes = ["single_choice", "multiple_choice", "true_false", "short_answer", "essay"];
      if (questions.some((q: any) => !q || !String(q.prompt || "").trim() || String(q.prompt).length > 5000 || !allowedTypes.includes(String(q.type || "single_choice")) || !Number.isFinite(Number(q.points ?? 1)) || Number(q.points ?? 1) < 0 || Number(q.points ?? 1) > 1000)) return json(400, { error: "Each question needs valid text, a supported type, and marks from 0 to 1000." });
      const fromTime = body.availableFrom ? new Date(String(body.availableFrom)).getTime() : null; const untilTime = body.availableUntil ? new Date(String(body.availableUntil)).getTime() : null;
      if ((fromTime !== null && !Number.isFinite(fromTime)) || (untilTime !== null && !Number.isFinite(untilTime)) || (fromTime !== null && untilTime !== null && untilTime <= fromTime)) return json(400, { error: "The examination closing time must be after its opening time." });
      const passcode = String(body.passcode || randomBytes(8).toString("hex").toUpperCase());
      if (passcode.length < 6 || passcode.length > 128) return json(400, { error: "Passcodes must be between 6 and 128 characters." });
      const salt = randomBytes(16).toString("hex");
      const status = body.status === "active" ? "active" : body.status === "scheduled" ? "scheduled" : "draft";
      const payload = { schoolId, classIds: Array.isArray(body.classIds) ? body.classIds.map(String).slice(0, 100) : [], title, subject, instructions: String(body.instructions || "").slice(0, 5000), questions: questions.map((q: any, i: number) => ({ id: String(q.id || "q" + (i + 1)), type: String(q.type || "single_choice"), prompt: String(q.prompt || "").slice(0, 5000), options: Array.isArray(q.options) ? q.options.slice(0, 10).map((o: any, j: number) => ({ id: String(o.id || j), text: String(o.text || "").slice(0, 1000) })) : [], correctOptionIds: Array.isArray(q.correctOptionIds) ? q.correctOptionIds.map(String) : [], acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.map(String).slice(0, 20) : [], points: Math.max(0, Math.min(1000, Number(q.points || 1))), required: q.required !== false })), durationMinutes, gradingMode: body.gradingMode === "manual" ? "manual" : "automatic", availableFrom: body.availableFrom ? String(body.availableFrom) : null, availableUntil: body.availableUntil ? String(body.availableUntil) : null, status, passcodeSalt: salt, passcodeHash: hashCode(salt, passcode), createdBy: c.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      const saved = await adminDb.collection("jdiExams").add(payload);
      return json(201, { exam: { id: saved.id, title, subject, status, durationMinutes, questionCount: questions.length }, passcode });
    }
    return json(404, { error: "Examination endpoint not found." });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH") return json(401, { error: "Authentication required." });
    if (error instanceof Error && error.message === "PROFILE") return json(403, { error: "Portal profile not found." });
    if (error instanceof Error && error.message === "INACTIVE") return json(403, { error: "Your account is not active." });
    if (error instanceof Error && error.message === "INACTIVE_EXAM") return json(409, { error: "This examination is no longer active." });
    if (error instanceof Error && error.message === "ATTEMPT_EXISTS") return json(409, { error: "An attempt for this examination has already been submitted." });
    console.error("JDI examination handler failed", error);
    return json(500, { error: "Unable to process the examination request." });
  }
};
