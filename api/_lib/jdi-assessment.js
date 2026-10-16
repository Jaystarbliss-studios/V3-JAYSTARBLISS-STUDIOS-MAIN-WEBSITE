/**
 * Pure assessment-domain validation and grading shared by request handlers and
 * the scheduled expiry worker. Keeping one implementation prevents score drift.
 */
const OBJECTIVE = new Set(["single_choice", "multiple_choice", "true_false"]);
const TYPES = new Set([...OBJECTIVE, "short_answer", "essay"]);

export function normalizeQuestions(input, gradingMode = "automatic") {
  if (!Array.isArray(input) || input.length < 1 || input.length > 200) {
    return { error: "Provide between 1 and 200 questions." };
  }
  const ids = new Set();
  const questions = [];
  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Each question must be an object." };
    const id = String(raw.id || `q${index + 1}`).trim();
    const prompt = String(raw.prompt || "").trim();
    const type = String(raw.type || "single_choice");
    const points = Number(raw.points ?? 1);
    if (!id || id.length > 120 || ids.has(id)) return { error: "Question IDs must be unique and no longer than 120 characters." };
    if (!prompt || prompt.length > 5000 || !TYPES.has(type)) return { error: "Each question needs valid text and a supported question type." };
    if (!Number.isFinite(points) || points < 0 || points > 1000) return { error: "Question marks must be between 0 and 1000." };
    ids.add(id);

    const options = Array.isArray(raw.options) ? raw.options : [];
    const cleanOptions = options.map((option, optionIndex) => ({
      id: String(option?.id || optionIndex).trim(),
      text: String(option?.text || "").trim(),
    }));
    if (OBJECTIVE.has(type)) {
      if (cleanOptions.length < 2 || cleanOptions.length > 10 ||
          (type === "true_false" && cleanOptions.length !== 2) ||
          cleanOptions.some(option => !option.id || option.id.length > 80 || !option.text || option.text.length > 1000) ||
          new Set(cleanOptions.map(option => option.id)).size !== cleanOptions.length) {
        return { error: "Objective questions need valid, unique options (2–10; exactly 2 for true/false)." };
      }
    }
    const optionIds = new Set(cleanOptions.map(option => option.id));
    const providedCorrect = Array.isArray(raw.correctOptionIds) ? raw.correctOptionIds.map(String) : [];
    const correctOptionIds = [...new Set(providedCorrect)];
    if (OBJECTIVE.has(type)) {
      if (gradingMode !== "manual" && !correctOptionIds.length) return { error: "Automatically graded objective questions need at least one correct answer." };
      if (correctOptionIds.some(optionId => !optionIds.has(optionId))) return { error: "Correct answers must refer to existing options." };
      if ((type === "single_choice" || type === "true_false") && correctOptionIds.length > 1) return { error: "Single-choice questions must have exactly one correct answer." };
    }
    const acceptedAnswers = Array.isArray(raw.acceptedAnswers)
      ? [...new Set(raw.acceptedAnswers.map(value => String(value).trim()).filter(Boolean).map(value => value.slice(0, 500)))].slice(0, 20)
      : [];
    questions.push({
      id, type, prompt, options: OBJECTIVE.has(type) ? cleanOptions : [],
      correctOptionIds: OBJECTIVE.has(type) ? correctOptionIds : [],
      acceptedAnswers: type === "short_answer" ? acceptedAnswers : [],
      points, required: raw.required !== false,
    });
  }
  return { questions };
}

export function gradeAnswers(exam, answers = {}) {
  let score = 0;
  let autoGraded = exam?.gradingMode !== "manual";
  const questionResults = [];
  for (const question of Array.isArray(exam?.questions) ? exam.questions : []) {
    const answer = answers?.[question.id];
    let correct = false;
    let manualReview = false;
    let pointsAwarded = 0;
    if (exam?.gradingMode === "manual") {
      autoGraded = false;
      manualReview = true;
    } else if (OBJECTIVE.has(String(question.type))) {
      const expected = [...new Set((Array.isArray(question.correctOptionIds) ? question.correctOptionIds : []).map(String))].sort();
      const actual = [...new Set((Array.isArray(answer) ? answer : [String(answer ?? "")]).map(String))].sort();
      if (!expected.length) {
        autoGraded = false;
        manualReview = true;
      } else {
        correct = expected.length === actual.length && expected.every((value, index) => value === actual[index]);
      }
    } else if (question.type === "short_answer" && Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length) {
      const normalize = value => String(value ?? "").trim().toLocaleLowerCase();
      correct = question.acceptedAnswers.some(value => normalize(value) === normalize(answer));
    } else {
      autoGraded = false;
      manualReview = true;
    }
    const maxPoints = Math.max(0, Math.min(1000, Number(question.points) || 0));
    if (correct) pointsAwarded = maxPoints;
    score += pointsAwarded;
    questionResults.push({
      questionId: question.id,
      ...(answer === undefined ? {} : { answer }),
      ...(manualReview ? {} : { correct }),
      manualReview,
      pointsAwarded,
      maxPoints,
    });
  }
  return { score, autoGraded, questionResults };
}

/** Safe projections for school-level reporting; never include answer keys or submitted response text. */
export function schoolSafeQuestion(question) {
  return {
    id: String(question?.id || ""),
    prompt: String(question?.prompt || ""),
    type: String(question?.type || ""),
    points: Math.max(0, Math.min(1000, Number(question?.points) || 0)),
    options: Array.isArray(question?.options) ? question.options.map(option => ({
      id: String(option?.id || ""),
      text: String(option?.text || ""),
    })) : [],
  };
}

export function schoolSafeQuestionResult(result) {
  return {
    questionId: String(result?.questionId || ""),
    ...(typeof result?.correct === "boolean" ? { correct: result.correct } : {}),
    manualReview: result?.manualReview === true,
    pointsAwarded: Math.max(0, Number(result?.pointsAwarded) || 0),
    maxPoints: Math.max(0, Number(result?.maxPoints) || 0),
  };
}

/** Parent result lookup must bind the record ID to the child's verified portal UID. */
export function attemptBelongsToLinkedChild(attempt, child) {
  return Boolean(child?.id && child?.studentUid && attempt?.studentId && attempt?.studentUid &&
    String(attempt.studentId) === String(child.id) &&
    String(attempt.studentUid) === String(child.studentUid));
}
