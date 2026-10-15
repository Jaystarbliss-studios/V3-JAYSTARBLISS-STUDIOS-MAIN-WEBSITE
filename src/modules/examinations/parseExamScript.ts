import type { ExamQuestion, QuestionType } from "./types";

const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : "question-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

/**
 * Deterministic import helper for teacher-pasted scripts. This is a draft parser,
 * not a substitute for teacher review. Supports numbered questions and A-D options.
 */
export function parseExamScript(source: string, defaultPoints = 1): ExamQuestion[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (/^\s*\d+[.)]\s+/.test(line)) {
      if (current.trim()) blocks.push(current.trim());
      current = line.replace(/^\s*\d+[.)]\s+/, "");
    } else if (current) {
      current += "\n" + line;
    }
  }
  if (current.trim()) blocks.push(current.trim());
  return blocks.map((block): ExamQuestion => {
    const rows = block.split("\n").map(row => row.trim()).filter(Boolean);
    const prompt = rows.shift() || "Untitled question";
    const optionRows = rows.map(row => row.match(/^\(?([A-D])\)?[.)]\s*(.+)$/)).filter(Boolean) as RegExpMatchArray[];
    let type: QuestionType = "short_answer";
    let options: ExamQuestion["options"] = [];
    if (optionRows.length >= 2) {
      type = "single_choice";
      options = optionRows.map(match => ({ id: match[1].toUpperCase(), text: match[2].trim() }));
    } else if (/^\s*(true|false)\s*$/i.test(prompt)) {
      type = "true_false";
      options = [{ id: "TRUE", text: "True" }, { id: "FALSE", text: "False" }];
    }
    return { id: makeId(), type, prompt, options, points: Math.max(0.25, defaultPoints), required: true };
  });
}
