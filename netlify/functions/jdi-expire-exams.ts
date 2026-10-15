import type { Handler } from "@netlify/functions";
import { adminDb } from "../../api/_lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const config = { schedule: "*/5 * * * *" };
export const handler: Handler = async () => {
  try {
    const now = new Date().toISOString();
    const candidates = await adminDb.collection("jdiExamAttempts").where("status", "==", "in_progress").limit(200).get(); const due = { docs: candidates.docs.filter(d => String(d.data().deadlineAt || "") <= now).slice(0, 100) };
    let expired = 0;
    for (const doc of due.docs) {
      const attempt = doc.data();
      const changed = await adminDb.runTransaction(async tx => {
        const current = await tx.get(doc.ref);
        if (!current.exists || current.data()?.status !== "in_progress" || String(current.data()?.deadlineAt || "") > now) return false;
        tx.update(doc.ref, { status: "expired", submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (!changed) continue;
      expired++;
      const examRef = adminDb.collection("jdiExams").doc(String(attempt.examId || ""));
      const examSnap = await examRef.get();
      const exam = examSnap.data() || {};
      if (exam.gradingMode !== "manual") {
        let score = 0; let autoGraded = true;
        const answers = attempt.answers || {};
        for (const q of Array.isArray(exam.questions) ? exam.questions : []) {
          const answer = answers[q.id];
          if (["single_choice", "multiple_choice", "true_false"].includes(String(q.type))) {
            const expected = Array.isArray(q.correctOptionIds) ? q.correctOptionIds.map(String).sort() : [];
            if (!expected.length) { autoGraded = false; continue; }
            const actual = (Array.isArray(answer) ? answer : [String(answer || "")]).map(String).sort();
            if (expected.length === actual.length && expected.every((v: string, i: number) => v === actual[i])) score += Number(q.points || 0);
          } else if (q.type === "short_answer" && Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length) {
            const normal = (v: unknown) => String(v || "").trim().toLowerCase();
            if (q.acceptedAnswers.some((v: string) => normal(v) === normal(answer))) score += Number(q.points || 0);
          } else autoGraded = false;
        }
        await doc.ref.update({ score, autoGraded, updatedAt: FieldValue.serverTimestamp() });
      }
      await examRef.collection("events").add({ type: "attempt_expired", attemptId: doc.id, studentId: attempt.studentId, schoolId: attempt.schoolId, createdAt: FieldValue.serverTimestamp() });
      const recipients = new Set<string>();
      const access = await adminDb.collection("staffSchoolAccess").where("schoolId", "==", String(attempt.schoolId || "")).limit(50).get().catch(() => null);
      access?.docs.forEach(item => recipients.add(item.id));
      const schoolUsers = await adminDb.collection("users").where("schoolId", "==", String(attempt.schoolId || "")).limit(50).get().catch(() => null);
      schoolUsers?.docs.forEach(item => {
        const role = String(item.data().role || "").toUpperCase();
        if (["SCHOOL", "SCHOOL_ADMIN", "ADMIN", "EDUCATION_ADMIN", "SUPER_ADMIN"].includes(role)) recipients.add(item.id);
      });
      const batch = adminDb.batch();
      recipients.delete(String(attempt.studentUid || ""));
      for (const uid of recipients) {
        const ref = adminDb.collection("jdiNotifications").doc();
        batch.set(ref, { recipientUid: uid, isRead: false, type: "exam_expired", title: "Examination time expired", message: String(exam.title || "A student examination") + " has reached its time limit.", examId: attempt.examId, attemptId: doc.id, schoolId: attempt.schoolId, createdAt: FieldValue.serverTimestamp() });
      }
      if (recipients.size) await batch.commit();
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, expired }) };
  } catch (error) {
    console.error("JDI scheduled expiry failed", error);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
