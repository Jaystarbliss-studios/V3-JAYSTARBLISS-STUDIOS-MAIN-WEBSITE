/** JAYSTARBLISS DYNAMIC INSTITUTE (JDI) examination domain types. */
export type ExamStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
export interface ExamOption { id: string; text: string }
export interface ExamQuestion { id: string; type: QuestionType; prompt: string; options: ExamOption[]; correctOptionIds?: string[]; acceptedAnswers?: string[]; points: number; required: boolean }
export interface ExamDefinition { id: string; schoolId: string; classIds: string[]; title: string; subject: string; instructions?: string; status: ExamStatus; durationMinutes: number; maxAttempts?: number; shuffleQuestions?: boolean; shuffleOptions?: boolean; gradingMode?: "automatic" | "manual"; availableFrom?: string; availableUntil?: string; questionCount: number; passcodeRequired: boolean; createdBy: string; createdAt: string; updatedAt: string }
export interface ExamAttempt { id: string; examId: string; studentId: string; status: 'in_progress' | 'submitted' | 'expired' | 'graded'; startedAt: string; deadlineAt: string; submittedAt?: string; score?: number; releasedAt?: string }
export interface QuestionBankEntry extends Omit<ExamQuestion, "id"> { bankId: string; schoolId: string; topic?: string; difficulty?: "easy" | "medium" | "hard"; createdBy: string; createdAt: string; updatedAt: string }
export interface PasscodeValidationRequest { examId: string; passcode: string }
export interface PasscodeValidationResponse { ok: boolean; attemptId?: string; message?: string }
