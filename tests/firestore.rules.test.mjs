import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const projectId = "demo-jaystarbliss-lms-rules";
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "school-admin"), { role: "SCHOOL_ADMIN", schoolId: "school-a" });
    await setDoc(doc(db, "users", "parent-a"), { role: "PARENT", email: "parent-a@example.com" });
    await setDoc(doc(db, "users", "parent-b"), { role: "PARENT", email: "parent-b@example.com" });
    await setDoc(doc(db, "users", "super-admin"), { role: "SUPER_ADMIN" });

    await setDoc(doc(db, "students", "child-a"), {
      fullName: "Child A",
      parentId: "parent-a",
      parentEmail: "parent-a@example.com",
      schoolId: "school-a",
      firebaseUid: "student-a",
    });
    await setDoc(doc(db, "students", "child-b"), {
      fullName: "Child B",
      parentId: "parent-b",
      parentEmail: "parent-b@example.com",
      schoolId: "school-b",
      firebaseUid: "student-b",
    });
    await setDoc(doc(db, "individualStudents", "child-a"), {
      fullName: "Child A",
      parentId: "parent-a",
      parentEmail: "parent-a@example.com",
      firebaseUid: "student-a",
    });

    await setDoc(doc(db, "schoolPasscodes", "school-a-passcode"), {
      schoolId: "school-a",
      passcodeHash: "not-for-client-reading",
      passcodeSalt: "server-only",
    });

    await setDoc(doc(db, "jdiExams", "exam-a"), { schoolId: "school-a", title: "Private exam" });
    await setDoc(doc(db, "jdiExamAttempts", "attempt-a"), { studentUid: "student-a", examId: "exam-a" });
    await setDoc(doc(db, "jdiQuestionBank", "question-a"), { schoolId: "school-a", prompt: "Private question" });
    await setDoc(doc(db, "jdiAttemptLimits", "limit-a"), { studentUid: "student-a", attemptCount: 1 });
    await setDoc(doc(db, "jdiPasscodeAttempts", "throttle-a"), { failedCount: 1 });

    await setDoc(doc(db, "notifications", "direct-parent-a"), {
      recipientId: "parent-a",
      recipientType: "specific_user",
      title: "Private notice",
      readBy: [],
    });
    await setDoc(doc(db, "notifications", "unscoped-broadcast"), {
      recipientId: "all",
      recipientType: "all",
      title: "Missing audience",
    });
    await setDoc(doc(db, "notifications", "explicit-broadcast"), {
      recipientId: "all",
      recipientType: "all",
      targetRole: "all",
      title: "Public announcement",
    });

    await setDoc(doc(db, "jdiNotifications", "private-parent-a"), {
      recipientUid: "parent-a", isRead: false, title: "Private JDI payment notice",
    });
    await setDoc(doc(db, "jdiNotifications", "private-parent-b"), {
      recipientUid: "parent-b", isRead: false, title: "Another user private notice",
    });
  });
});

after(async () => {
  await env?.cleanup();
});

test("parent can read their child using parentId", async () => {
  const db = env.authenticatedContext("parent-a", { email: "parent-a@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "students", "child-a")));
});

test("parent can read legacy child records by their own verified email", async () => {
  const db = env.authenticatedContext("parent-a", { email: "parent-a@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "individualStudents", "child-a")));
});

test("a parent cannot read another parent's child record", async () => {
  const db = env.authenticatedContext("parent-a", { email: "parent-a@example.com" }).firestore();
  await assertFails(getDoc(doc(db, "students", "child-b")));
});

test("school administrators can read only students linked to their school", async () => {
  const db = env.authenticatedContext("school-admin", { email: "school@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "students", "child-a")));
  await assertFails(getDoc(doc(db, "students", "child-b")));
});

test("unscoped broadcasts are not readable by ordinary users", async () => {
  const db = env.authenticatedContext("parent-a", { email: "parent-a@example.com" }).firestore();
  await assertFails(getDoc(doc(db, "notifications", "unscoped-broadcast")));
});

test("explicit all-audience announcements and direct notices are readable by intended recipients", async () => {
  const db = env.authenticatedContext("parent-a", { email: "parent-a@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "notifications", "direct-parent-a")));
  await assertSucceeds(getDoc(doc(db, "notifications", "explicit-broadcast")));
});

test("JDI notifications are private even from other administrators", async () => {
  const parentDb = env.authenticatedContext("parent-a", { email: "parent-a@example.com" }).firestore();
  const adminDb = env.authenticatedContext("super-admin", { email: "admin@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(parentDb, "jdiNotifications", "private-parent-a")));
  await assertFails(getDoc(doc(parentDb, "jdiNotifications", "private-parent-b")));
  await assertFails(getDoc(doc(adminDb, "jdiNotifications", "private-parent-a")));
});

test("a recipient cannot change the shared notification document read state", async () => {
  const db = env.authenticatedContext("parent-a", { email: "parent-a@example.com" }).firestore();
  await assertFails(updateDoc(doc(db, "notifications", "direct-parent-a"), { readBy: ["parent-a"] }));
});

test("Super Admin can read student records across schools", async () => {
  const db = env.authenticatedContext("super-admin", { email: "admin@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "students", "child-a")));
  await assertSucceeds(getDoc(doc(db, "students", "child-b")));
});

test("an email merely containing the word admin does not grant administrator access", async () => {
  const db = env.authenticatedContext("not-an-admin", { email: "notadmin@example.com" }).firestore();
  await assertFails(getDoc(doc(db, "students", "child-a")));
});

test("users can create only their own basic parent/student profile", async () => {
  const parentDb = env.authenticatedContext("new-parent", { email: "new-parent@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(parentDb, "users", "new-parent"), { role: "parent", email: "new-parent@example.com" }));
  const attackerDb = env.authenticatedContext("new-admin", { email: "new-admin@example.com" }).firestore();
  await assertFails(setDoc(doc(attackerDb, "users", "new-admin"), { role: "super_admin", email: "new-admin@example.com" }));
});

test("users cannot read other users' private profiles", async () => {
  const db = env.authenticatedContext("parent-a", { email: "parent-a@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(db, "users", "parent-a")));
  await assertFails(getDoc(doc(db, "users", "parent-b")));
});

test("only Super Admin can create administrator records", async () => {
  const parentDb = env.authenticatedContext("parent-a", { email: "parent-a@example.com" }).firestore();
  await assertFails(setDoc(doc(parentDb, "admins", "parent-a"), { role: "SUPER_ADMIN" }));
  const adminDb = env.authenticatedContext("super-admin", { email: "admin@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(adminDb, "admins", "new-admin"), { role: "SUPER_ADMIN" }));
});


test("exam answers, attempts, question banks, limits and passcode throttles are server-only", async () => {
  const studentDb = env.authenticatedContext("student-a", { email: "student@example.com" }).firestore();
  const collections = [
    ["jdiExams", "exam-a"],
    ["jdiExamAttempts", "attempt-a"],
    ["jdiQuestionBank", "question-a"],
    ["jdiAttemptLimits", "limit-a"],
    ["jdiPasscodeAttempts", "throttle-a"],
  ];
  for (const [collectionName, docId] of collections) {
    await assertFails(getDoc(doc(studentDb, collectionName, docId)));
    await assertFails(setDoc(doc(studentDb, collectionName, "client-write"), { unsafe: true }));
  }
});

test("school users cannot read or mutate legacy passcode documents directly", async () => {
  const schoolDb = env.authenticatedContext("school-admin", { email: "school@example.com" }).firestore();
  await assertFails(getDoc(doc(schoolDb, "schoolPasscodes", "school-a-passcode")));
  await assertFails(updateDoc(doc(schoolDb, "schoolPasscodes", "school-a-passcode"), { passcodeHash: "changed" }));

  const studentDb = env.authenticatedContext("student-a", { email: "student@example.com" }).firestore();
  await assertFails(getDoc(doc(studentDb, "schoolPasscodes", "school-a-passcode")));
});
