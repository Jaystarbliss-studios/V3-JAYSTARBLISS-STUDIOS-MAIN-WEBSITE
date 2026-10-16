import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuestions, gradeAnswers, schoolSafeQuestion, schoolSafeQuestionResult, attemptBelongsToLinkedChild, isAssessmentStudentRole, answersForFinalization } from "../api/_lib/jdi-assessment.js";

const objective = (overrides = {}) => ({
  id: "q1", type: "single_choice", prompt: "Pick one", points: 2,
  options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
  correctOptionIds: ["a"], ...overrides,
});

test("normalizes question IDs and deduplicates answer keys before persistence", () => {
  const result = normalizeQuestions([objective({ correctOptionIds: ["a", "a"] })]);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.questions[0].correctOptionIds, ["a"]);
});

test("rejects duplicate question IDs and unknown correct-option IDs", () => {
  assert.match(normalizeQuestions([objective(), objective()]).error, /unique/);
  assert.match(normalizeQuestions([objective({ correctOptionIds: ["missing"] })]).error, /existing options/);
});

test("requires a marking key for automatic objective grading but permits manual marking", () => {
  assert.match(normalizeQuestions([objective({ correctOptionIds: [] })]).error, /correct answer/);
  assert.equal(normalizeQuestions([objective({ correctOptionIds: [] })], "manual").error, undefined);
});

test("enforces objective option limits, true/false shape, and bounded points", () => {
  assert.match(normalizeQuestions([objective({ options: [{ id: "a", text: "A" }] })]).error, /options/);
  assert.match(normalizeQuestions([objective({ type: "true_false", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }] })]).error, /exactly 2/);
  assert.match(normalizeQuestions([objective({ points: 1001 })]).error, /marks/);
});

test("grades exact objective answers and never awards credit for partial multiple choice", () => {
  const exam = { gradingMode: "automatic", questions: [
    objective(),
    objective({ id: "q2", type: "multiple_choice", correctOptionIds: ["a", "b"], points: 3 }),
  ] };
  assert.equal(gradeAnswers(exam, { q1: "a", q2: ["a"] }).score, 2);
  assert.equal(gradeAnswers(exam, { q1: "a", q2: ["b", "a"] }).score, 5);
});

test("grades short answers case-insensitively and sends essays to manual review", () => {
  const exam = { questions: [
    { id: "short", type: "short_answer", points: 1, acceptedAnswers: ["Ohm"] },
    { id: "essay", type: "essay", points: 4 },
  ] };
  const result = gradeAnswers(exam, { short: "  OHM " , essay: "written response" });
  assert.equal(result.score, 1);
  assert.equal(result.autoGraded, false);
  assert.equal(result.questionResults[1].manualReview, true);
});

test("manual grading never auto-awards marks", () => {
  const result = gradeAnswers({ gradingMode: "manual", questions: [objective()] }, { q1: "a" });
  assert.equal(result.score, 0);
  assert.equal(result.autoGraded, false);
  assert.equal(result.questionResults[0].manualReview, true);
});

test("school report projections omit answer keys, explanations, and submitted answer text", () => {
  const question = schoolSafeQuestion({ id: "q", prompt: "Question", type: "single_choice", points: 2, options: [{ id: "a", text: "A" }], correctOptionIds: ["a"], acceptedAnswers: ["secret"], explanation: "teacher-only" });
  assert.deepEqual(Object.keys(question).sort(), ["id", "options", "points", "prompt", "type"]);
  assert.equal("correctOptionIds" in question, false);
  assert.equal("acceptedAnswers" in question, false);
  const result = schoolSafeQuestionResult({ questionId: "q", answer: "private response", correct: true, manualReview: false, pointsAwarded: 2, maxPoints: 2 });
  assert.equal(result.correct, true);
  assert.equal("answer" in result, false);
});

test("parent result lookup requires both matching learner record ID and learner UID", () => {
  const child = { id: "child-a", studentUid: "student-uid-a" };
  assert.equal(attemptBelongsToLinkedChild({ studentId: "child-a", studentUid: "student-uid-a" }, child), true);
  assert.equal(attemptBelongsToLinkedChild({ studentId: "child-a", studentUid: "student-uid-b" }, child), false);
  assert.equal(attemptBelongsToLinkedChild({ studentId: "child-b", studentUid: "student-uid-a" }, child), false);
  assert.equal(attemptBelongsToLinkedChild({ studentId: "child-a" }, child), false);
});


test("assessment access accepts school and individual learner role aliases", () => {
  assert.equal(isAssessmentStudentRole("STUDENT"), true);
  assert.equal(isAssessmentStudentRole("student"), true);
  assert.equal(isAssessmentStudentRole("INDIVIDUAL_STUDENT"), true);
  assert.equal(isAssessmentStudentRole("individualstudent"), true);
  assert.equal(isAssessmentStudentRole("PARENT"), false);
  assert.equal(isAssessmentStudentRole("TUTOR"), false);
});

test("expired attempt finalization uses persisted answers, not late client payload", () => {
  const saved = { q1: "a" };
  assert.deepEqual(answersForFinalization(saved, { q1: "b" }, true), saved);
  assert.deepEqual(answersForFinalization(saved, { q1: "b" }, false), { q1: "b" });
  assert.deepEqual(answersForFinalization(saved, undefined, false), saved);
});
