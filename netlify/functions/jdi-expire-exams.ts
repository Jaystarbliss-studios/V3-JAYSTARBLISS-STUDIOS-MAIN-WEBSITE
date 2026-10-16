import type { Handler } from "@netlify/functions";
import { adminDb } from "../../api/_lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const config = { schedule: "*/5 * * * *" };

function gradeExpiredAttempt(exam: any, answers: Record<string, any>) {
  let score = 0;
  let autoGraded = exam.gradingMode !== "manual";
  const questionResults: any[] = [];
  for (const q of Array.isArray(exam.questions) ? exam.questions : []) {
    const answer = answers[q.id];
    let correct = false;
    let manualReview = false;
    let pointsAwarded = 0;
    if (exam.gradingMode === "manual") {
      autoGraded = false;
      manualReview = true;
    } else if (["single_choice", "multiple_choice", "true_false"].includes(String(q.type))) {
      const expected = Array.isArray(q.correctOptionIds) ? q.correctOptionIds.map(String).sort() : [];
      const actual = (Array.isArray(answer) ? answer : [String(answer || "")]).map(String).sort();
      if (!expected.length) {
        autoGraded = false;
        manualReview = true;
      } else {
        correct = expected.length === actual.length && expected.every((v: string, i: number) => v === actual[i]);
      }
    } else if (q.type === "short_answer" && Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length) {
      const normal = (v: unknown) => String(v || "").trim().toLowerCase();
      correct = q.acceptedAnswers.some((v: string) => normal(v) === normal(answer));
    } else {
      autoGraded = false;
      manualReview = true;
    }
    if (correct) pointsAwarded = Math.max(0, Number(q.points) || 0);
    score += pointsAwarded;
    questionResults.push({
      questionId: q.id,
      ...(answer === undefined ? {} : { answer }),
      ...(manualReview ? {} : { correct }),
      manualReview,
      pointsAwarded,
      maxPoints: Math.max(0, Number(q.points) || 0),
    });
  }
  return { score, autoGraded, questionResults };
}

export const handler: Handler = async () => {
  try {
    const now = new Date().toISOString();
    const due = await adminDb.collection("jdiExamAttempts")
      .where("deadlineAt", "<=", now)
      .orderBy("deadlineAt", "asc")
      .limit(100)
      .get();
    let expired = 0;

    for (const attemptDoc of due.docs) {
      const initial = attemptDoc.data();
      const examRef = adminDb.collection("jdiExams").doc(String(initial.examId || ""));
      const examSnap = await examRef.get();
      const exam = examSnap.data() || {};

      // Persist expiry and the complete grade in one transaction. If grading or
      // the transaction fails, the attempt remains in_progress and can be retried
      // by the next scheduled run instead of being stranded as an ungraded expiry.
      const outcome = await adminDb.runTransaction(async tx => {
        const currentSnap = await tx.get(attemptDoc.ref);
        if (!currentSnap.exists) return null;
        const current = currentSnap.data() || {};
        if (current.status !== "in_progress" || String(current.deadlineAt || "") > now) return null;
        const grading = gradeExpiredAttempt(exam, current.answers || {});
        tx.update(attemptDoc.ref, {
          ...grading,
          status: "expired",
          deadlineAt: FieldValue.delete(),
          submittedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { ...current, ...grading };
      });
      if (!outcome) continue;
      expired++;

      await examRef.collection("events").add({
        type: "attempt_expired",
        attemptId: attemptDoc.id,
        studentId: outcome.studentId,
        schoolId: outcome.schoolId || null,
        score: outcome.score,
        autoGraded: outcome.autoGraded,
        createdAt: FieldValue.serverTimestamp(),
      });

      const resolvedSchoolId = String(outcome.schoolId || exam.schoolId || "");
      const recipients = new Set<string>();
      if (exam.createdBy) recipients.add(String(exam.createdBy));
      if (resolvedSchoolId) {
        const schoolUsers = await adminDb.collection("users")
          .where("schoolId", "==", resolvedSchoolId)
          .limit(50).get().catch(() => null);
        schoolUsers?.docs.forEach(item => {
          const role = String(item.data().role || "").toUpperCase();
          if (["SCHOOL", "SCHOOL_ADMIN"].includes(role)) recipients.add(item.id);
        });
      } else {
        let student = await adminDb.collection("individualStudents").doc(String(outcome.studentId || "")).get();
        if (!student.exists) student = await adminDb.collection("students").doc(String(outcome.studentId || "")).get();
        const parentId = String(student.data()?.parentId || student.data()?.guardianId || "");
        if (parentId) recipients.add(parentId);
      }
      recipients.delete(String(outcome.studentUid || ""));
      if (recipients.size) {
        const batch = adminDb.batch();
        for (const uid of recipients) {
          const notificationRef = adminDb.collection("jdiNotifications").doc();
          batch.set(notificationRef, {
            recipientUid: uid,
            isRead: false,
            type: "exam_expired",
            title: "Examination time expired",
            message: String(exam.title || "A student examination") + " has reached its time limit.",
            examId: outcome.examId,
            attemptId: attemptDoc.id,
            schoolId: resolvedSchoolId || null,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      }
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, expired }) };
  } catch (error) {
    console.error("JDI scheduled expiry failed", error);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
