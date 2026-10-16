import type { Exam, ExamQuestion } from "./types";

export type ExamReviewData = {
  exam: Exam;
  questions: ExamQuestion[];
  selectedAnswers: Record<string, number>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/** Normalize the nested API payload and discard answers that do not match a saved question. */
export function mapExamReviewPayload(payload: unknown): ExamReviewData | null {
  if (!isRecord(payload) || !isRecord(payload.exam)) return null;
  const rawExam = payload.exam;
  if (typeof rawExam.id !== "string") return null;

  const questions = (
    Array.isArray(rawExam.learning_exam_questions) ? rawExam.learning_exam_questions : []
  )
    .filter(
      (value): value is ExamQuestion =>
        isRecord(value) &&
        typeof value.id === "string" &&
        typeof value.order_index === "number" &&
        isRecord(value.question) &&
        typeof value.question.prompt === "string" &&
        Array.isArray(value.question.choices) &&
        typeof value.question.correctIndex === "number",
    )
    .sort((left, right) => left.order_index - right.order_index);

  const questionById = new Map(questions.map((question) => [question.id, question]));
  const selectedAnswers: Record<string, number> = {};
  if (Array.isArray(payload.answers)) {
    for (const value of payload.answers) {
      if (!isRecord(value) || typeof value.question_id !== "string") continue;
      if (!isRecord(value.user_answer)) continue;
      const selectedIndex = value.user_answer.selectedIndex;
      const question = questionById.get(value.question_id);
      if (
        question &&
        typeof selectedIndex === "number" &&
        Number.isInteger(selectedIndex) &&
        selectedIndex >= 0 &&
        selectedIndex < question.question.choices.length
      ) {
        selectedAnswers[value.question_id] = selectedIndex;
      }
    }
  }

  return {
    exam: rawExam as unknown as Exam,
    questions,
    selectedAnswers,
  };
}
