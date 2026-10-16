export interface NormalizedQuestion {
  id: string; type: "single_choice" | "multiple_choice" | "true_false" | "short_answer" | "essay";
  prompt: string; options: Array<{ id: string; text: string }>; correctOptionIds: string[];
  acceptedAnswers: string[]; points: number; required: boolean;
}
export function normalizeQuestions(input: unknown, gradingMode?: string): { questions: NormalizedQuestion[]; error?: never } | { error: string; questions?: never };
export function gradeAnswers(exam: { gradingMode?: string; questions?: Array<any> }, answers?: Record<string, any>): {
  score: number; autoGraded: boolean; questionResults: Array<Record<string, any>>;
};
