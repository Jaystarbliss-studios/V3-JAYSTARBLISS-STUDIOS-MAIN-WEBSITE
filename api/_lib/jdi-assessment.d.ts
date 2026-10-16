export interface NormalizedQuestion {
  id: string; type: "single_choice" | "multiple_choice" | "true_false" | "short_answer" | "essay";
  prompt: string; options: Array<{ id: string; text: string }>; correctOptionIds: string[];
  acceptedAnswers: string[]; points: number; required: boolean;
}
export function isAssessmentStudentRole(role: unknown): boolean;
export function normalizeQuestions(input: unknown, gradingMode?: string): { questions: NormalizedQuestion[]; error?: never } | { error: string; questions?: never };
export function gradeAnswers(exam: { gradingMode?: string; questions?: Array<any> }, answers?: Record<string, any>): {
  score: number; autoGraded: boolean; questionResults: Array<Record<string, any>>;
};

export function schoolSafeQuestion(question: Record<string, any>): {
  id: string; prompt: string; type: string; points: number; options: Array<{ id: string; text: string }>;
};
export function schoolSafeQuestionResult(result: Record<string, any>): {
  questionId: string; correct?: boolean; manualReview: boolean; pointsAwarded: number; maxPoints: number;
};

export function attemptBelongsToLinkedChild(attempt: Record<string, any>, child: { id: string; studentUid: string }): boolean;
