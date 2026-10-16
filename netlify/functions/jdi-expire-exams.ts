import type { Handler } from "@netlify/functions";
import { adminDb } from "../../api/_lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { gradeAnswers } from "../../api/_lib/jdi-assessment.js";

export const config = { schedule: "*/5 * * * *" };

async function notifyExamStatus(examId: string, exam: any, status: "active" | "completed") {
  const recipients = new Set<string>();
  if (exam.createdBy) recipients.add(String(exam.createdBy));
  const schoolId = String(exam.schoolId || "");
  if (exam.audienceType === "individual") {
    (Array.isArray(exam.studentUids) ? exam.studentUids : []).forEach((uid: unknown) => recipients.add(String(uid || "")));
  } else if (schoolId) {
    const [schoolStudents, individuals, schoolUsers] = await Promise.all([
      adminDb.collection("students").where("schoolId", "==", schoolId).limit(500).get().catch(() => null),
      adminDb.collection("individualStudents").where("schoolId", "==", schoolId).limit(500).get().catch(() => null),
      adminDb.collection("users").where("schoolId", "==", schoolId).limit(100).get().catch(() => null),
    ]);
    const classes = Array.isArray(exam.classIds) ? exam.classIds.map(String) : [];
    for (const snapshot of [schoolStudents, individuals]) {
      snapshot?.docs.forEach(doc => {
        const student = doc.data();
        const classId = String(student.classId || student.class_id || student.classLevel || student.className || student.class || "");
        if (classes.length && !classes.includes(classId) && !classes.includes("all")) return;
        const uid = String(student.firebaseUid || student.userId || student.uid || doc.id);
        if (uid) recipients.add(uid);
      });
    }
    schoolUsers?.docs.forEach(doc => {
      if (["SCHOOL", "SCHOOL_ADMIN"].includes(String(doc.data().role || "").toUpperCase())) recipients.add(doc.id);
    });
  }
  const allRecipients = [...recipients].filter(Boolean);
  for (let offset = 0; offset < allRecipients.length; offset += 400) {
    const batch = adminDb.batch();
    for (const uid of allRecipients.slice(offset, offset + 400)) {
      const notificationRef = adminDb.collection("jdiNotifications").doc();
      batch.set(notificationRef, {
        recipientUid: uid,
        isRead: false,
        type: status === "active" ? "exam_available" : "exam_closed",
        title: status === "active" ? "Examination is now available" : "Examination has closed",
        message: String(exam.title || "An examination") + (status === "active" ? " is now available to take." : " has reached its scheduled closing time."),
        examId,
        schoolId: schoolId || null,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

async function updateScheduledExamStatuses(now: string) {
  let activated = 0;
  let completed = 0;
  const nowMs = Date.parse(now);
  const scheduled = await adminDb.collection("jdiExams")
    .where("status", "==", "scheduled")
    .where("availableFrom", "<=", now)
    .orderBy("availableFrom", "asc")
    .limit(100)
    .get()
    .catch(async error => {
      // Fall back during rollout until the composite index has finished building.
      console.warn("Scheduled exam index unavailable; using bounded fallback scan.", error);
      return adminDb.collection("jdiExams").where("status", "==", "scheduled").limit(500).get();
    });

  for (const doc of scheduled.docs) {
    const ref = doc.ref;
    const initial = doc.data();
    const result = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const exam = snap.data() || {};
      if (exam.status !== "scheduled") return null;
      const from = Date.parse(String(exam.availableFrom || ""));
      if (!Number.isFinite(from) || from > nowMs) return null;
      const until = exam.availableUntil ? Date.parse(String(exam.availableUntil)) : Number.MAX_SAFE_INTEGER;
      if (Number.isFinite(until) && until <= nowMs) {
        tx.update(ref, { status: "completed", updatedAt: FieldValue.serverTimestamp(), autoClosedAt: FieldValue.serverTimestamp() });
        return { status: "completed" as const, exam };
      }
      tx.update(ref, { status: "active", updatedAt: FieldValue.serverTimestamp(), autoActivatedAt: FieldValue.serverTimestamp() });
      return { status: "active" as const, exam };
    });
    if (!result) continue;
    if (result.status === "active") activated++; else completed++;
    await notifyExamStatus(doc.id, { ...initial, ...result.exam }, result.status).catch(error => {
      console.error("Unable to notify scheduled exam status", doc.id, error);
    });
    await ref.collection("events").add({
      type: result.status === "active" ? "exam_auto_activated" : "exam_auto_completed",
      createdAt: FieldValue.serverTimestamp(),
      system: true,
    }).catch(error => console.error("Unable to write scheduled exam audit event", doc.id, error));
  }

  const dueToClose = await adminDb.collection("jdiExams")
    .where("status", "==", "active")
    .where("availableUntil", "<=", now)
    .orderBy("availableUntil", "asc")
    .limit(100)
    .get()
    .catch(async error => {
      console.warn("Closing exam index unavailable; using bounded fallback scan.", error);
      return adminDb.collection("jdiExams").where("status", "==", "active").limit(500).get();
    });
  for (const doc of dueToClose.docs) {
    const result = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(doc.ref);
      if (!snap.exists) return null;
      const exam = snap.data() || {};
      if (exam.status !== "active" || !exam.availableUntil || Date.parse(String(exam.availableUntil)) > nowMs) return null;
      tx.update(doc.ref, { status: "completed", updatedAt: FieldValue.serverTimestamp(), autoClosedAt: FieldValue.serverTimestamp() });
      return exam;
    });
    if (!result) continue;
    completed++;
    await notifyExamStatus(doc.id, result, "completed").catch(error => {
      console.error("Unable to notify closed exam status", doc.id, error);
    });
    await doc.ref.collection("events").add({
      type: "exam_auto_completed",
      createdAt: FieldValue.serverTimestamp(),
      system: true,
    }).catch(error => console.error("Unable to write closed exam audit event", doc.id, error));
  }
  return { activated, completed };
}

export const handler: Handler = async () => {
  try {
    const now = new Date().toISOString();
    const examStatuses = await updateScheduledExamStatuses(now);
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
      // the transaction fails, the attempt remains in_progress and can be retried.
      const outcome: any = await adminDb.runTransaction(async tx => {
        const currentSnap = await tx.get(attemptDoc.ref);
        if (!currentSnap.exists) return null;
        const current = currentSnap.data() || {};
        if (current.status !== "in_progress" || String(current.deadlineAt || "") > now) return null;
        const grading = gradeAnswers(exam, current.answers || {});
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
    return { statusCode: 200, body: JSON.stringify({ ok: true, expired, examStatuses }) };
  } catch (error) {
    console.error("JDI scheduled expiry failed", error);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
