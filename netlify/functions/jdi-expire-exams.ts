import type { Handler } from "@netlify/functions";
import { adminDb } from "../../api/_lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const config = { schedule: "*/5 * * * *" };
export const handler: Handler = async () => {
  try {
    const now = new Date().toISOString();
    const due = await adminDb.collection("jdiExamAttempts").where("deadlineAt", "<=", now).orderBy("deadlineAt", "asc").limit(100).get();
    let expired = 0;
    for (const doc of due.docs) {
      const attempt = doc.data();
      const changed = await adminDb.runTransaction(async tx => {
        const current = await tx.get(doc.ref);
        if (!current.exists || current.data()?.status !== "in_progress" || String(current.data()?.deadlineAt || "") > now) return false;
        tx.update(doc.ref, { status: "expired", deadlineAt: FieldValue.delete(), submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (!changed) continue;
      expired++;
      const schoolId = String(attempt.schoolId || "");
      const examRef = adminDb.collection("jdiExams").doc(String(attempt.examId || ""));
      const examSnap = await examRef.get();
      const exam = examSnap.data() || {};
      let score = 0; let autoGraded = exam.gradingMode !== "manual"; const questionResults: any[] = [];
      const answers = attempt.answers || {};
      for (const q of Array.isArray(exam.questions) ? exam.questions : []) {
        const answer = answers[q.id]; let correct = false; let manualReview = false; let pointsAwarded = 0;
        if (exam.gradingMode === "manual") { autoGraded = false; manualReview = true; }
        else if (["single_choice", "multiple_choice", "true_false"].includes(String(q.type))) {
          const expected = Array.isArray(q.correctOptionIds) ? q.correctOptionIds.map(String).sort() : [];
          const actual = (Array.isArray(answer) ? answer : [String(answer || "")]).map(String).sort();
          if (!expected.length) { autoGraded = false; manualReview = true; }
          else correct = expected.length === actual.length && expected.every((v: string, i: number) => v === actual[i]);
        } else if (q.type === "short_answer" && Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length) {
          const normal = (v: unknown) => String(v || "").trim().toLowerCase();
          correct = q.acceptedAnswers.some((v: string) => normal(v) === normal(answer));
        } else { autoGraded = false; manualReview = true; }
        if (correct) pointsAwarded = Math.max(0, Number(q.points) || 0);
        score += pointsAwarded;
        questionResults.push({ questionId: q.id, ...(answer === undefined ? {} : { answer }), ...(manualReview ? {} : { correct }), manualReview, pointsAwarded, maxPoints: Math.max(0, Number(q.points) || 0) });
      }
      await doc.ref.update({ score, autoGraded, questionResults, updatedAt: FieldValue.serverTimestamp() });
      await examRef.collection("events").add({ type: "attempt_expired", attemptId: doc.id, studentId: attempt.studentId, schoolId: schoolId || null, createdAt: FieldValue.serverTimestamp() });
      const recipients = new Set<string>(); if (exam.createdBy) recipients.add(String(exam.createdBy));
      const resolvedSchoolId = schoolId || String(exam.schoolId || "");
      if (resolvedSchoolId) {
        const schoolUsers = await adminDb.collection("users").where("schoolId", "==", resolvedSchoolId).limit(50).get().catch(() => null);
        schoolUsers?.docs.forEach(item => { const role = String(item.data().role || "").toUpperCase(); if (["SCHOOL", "SCHOOL_ADMIN"].includes(role)) recipients.add(item.id); });
      } else {
        let student = await adminDb.collection("individualStudents").doc(String(attempt.studentId || "")).get();
        if (!student.exists) student = await adminDb.collection("students").doc(String(attempt.studentId || "")).get();
        const parentId = String(student.data()?.parentId || student.data()?.guardianId || "");
        if (parentId) recipients.add(parentId);
      }
      const batch = adminDb.batch();
      recipients.delete(String(attempt.studentUid || ""));
      for (const uid of recipients) {
        const ref = adminDb.collection("jdiNotifications").doc();
        batch.set(ref, { recipientUid: uid, isRead: false, type: "exam_expired", title: "Examination time expired", message: String(exam.title || "A student examination") + " has reached its time limit.", examId: attempt.examId, attemptId: doc.id, schoolId: resolvedSchoolId || null, createdAt: FieldValue.serverTimestamp() });
      }
      if (recipients.size) await batch.commit();
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, expired }) };
  } catch (error) {
    console.error("JDI scheduled expiry failed", error);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
