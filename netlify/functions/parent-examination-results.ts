import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});
const bearer = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};
const iso = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
const nameOf = (student: any) =>
  String(student.fullName || student.studentName || student.name ||
    [student.firstName, student.lastName].filter(Boolean).join(" ") || "Learner");
const blocked = (value: unknown) =>
  ["DISABLED", "SUSPENDED", "BANNED"].includes(String(value || "").trim().toUpperCase());

async function linkedChildren(parentUid: string) {
  const found = new Map<string, { id: string; name: string; className: string }>();
  for (const collectionName of ["individualStudents", "students"]) {
    // Older portal records use different guardian field names. Each query is
    // still anchored to the verified parent's Firebase UID and never a client ID.
    for (const field of ["parentId", "guardianId", "parentUid", "parentUserId", "parentFirebaseUid"]) {
      const snap = await adminDb.collection(collectionName).where(field, "==", parentUid).limit(100).get();
      snap.forEach(doc => {
        const data = doc.data();
        found.set(doc.id, {
          id: doc.id,
          name: nameOf(data),
          className: String(data.className || data.class || data.grade || data.classLevel || ""),
        });
      });
    }
  }
  return found;
}

export const handler: Handler = async event => {
  try {
    if (event.httpMethod !== "GET") {
      return { ...json(405, { error: "Method not allowed." }), headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Allow: "GET" } };
    }
    const token = bearer(event);
    if (!token) return json(401, { error: "Please sign in again." });
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) return json(403, { error: "Portal profile not found." });
    const user = userSnap.data() || {};
    if (String(user.role || "").trim().toUpperCase() !== "PARENT") {
      return json(403, { error: "Parent access is required." });
    }
    if (blocked(user.accountStatus || user.status)) {
      return json(403, { error: "This account is not active." });
    }

    const children = await linkedChildren(decoded.uid);
    if (!children.size) return json(200, { children: [], results: [] });

    const attemptsById = new Map<string, any>();
    for (const childId of children.keys()) {
      const snap = await adminDb.collection("jdiExamAttempts")
        .where("studentId", "==", childId).limit(200).get();
      snap.forEach(doc => {
        const attempt = doc.data();
        // Results are visible to parents only after an explicit staff release.
        if (!attempt.releasedAt) return;
        attemptsById.set(doc.id, { id: doc.id, ...attempt });
      });
    }

    const results = await Promise.all([...attemptsById.values()].map(async attempt => {
      const examId = String(attempt.examId || "");
      if (!examId) return null;
      const examSnap = await adminDb.collection("jdiExams").doc(examId).get();
      if (!examSnap.exists) return null;
      const exam = examSnap.data() || {};
      const child = children.get(String(attempt.studentId));
      if (!child) return null;

      const rawScore = attempt.score;
      const score = rawScore === null || rawScore === undefined || rawScore === "" ? NaN : Number(rawScore);
      const examQuestions = Array.isArray(exam.questions) ? exam.questions : [];
      const calculatedMax = examQuestions.reduce((total: number, q: any) => {
        const points = Number(q?.points ?? 1);
        return total + (Number.isFinite(points) && points > 0 ? points : 0);
      }, 0);
      const rawMax = attempt.maxScore;
      const maxScore = rawMax === null || rawMax === undefined || rawMax === "" ? calculatedMax : Number(rawMax);
      return {
        attemptId: attempt.id,
        examId,
        studentId: child.id,
        studentName: child.name,
        className: child.className,
        title: String(exam.title || "Examination"),
        subject: String(exam.subject || ""),
        status: String(attempt.status || "submitted"),
        ...(Number.isFinite(score) ? { score } : {}),
        ...(Number.isFinite(maxScore) && maxScore >= 0 ? { maxScore } : {}),
        ...(Number.isFinite(score) && Number.isFinite(maxScore) && maxScore > 0
          ? { percentage: Math.round((score / maxScore) * 100) }
          : {}),
        submittedAt: iso(attempt.submittedAt),
        releasedAt: iso(attempt.releasedAt),
        feedback: String(attempt.feedback || ""),
      };
    }));
    results.sort((a, b) => String(b?.releasedAt || "").localeCompare(String(a?.releasedAt || "")));
    return json(200, {
      children: [...children.values()].sort((a, b) => a.name.localeCompare(b.name)),
      results: results.filter(Boolean),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load examination results.";
    if (message.includes("Firebase ID token") || message.includes("auth/")) {
      return json(401, { error: "Please sign in again." });
    }
    console.error("Parent examination results failed", error);
    return json(500, { error: "Unable to load examination results right now." });
  }
};
