import { describe, expect, it } from "vitest";
import { mapExamReviewPayload } from "./exams";

const question = (id: string, order_index: number) => ({
  id,
  exam_id: "exam-1",
  concept_id: "concept-1",
  order_index,
  difficulty: 3,
  points: 1,
  question_type: "mcq" as const,
  question: {
    id: `question-${id}`,
    conceptId: "concept-1",
    prompt: `Question ${id}`,
    choices: ["A", "B"],
    correctIndex: 0,
    hint: "Hint",
    explanation: "Explanation",
    difficulty: 3 as const,
    rubric: "Rubric",
    aiGenerated: true,
  },
});

describe("mapExamReviewPayload", () => {
  it("sorts saved questions and restores valid selected answers", () => {
    const result = mapExamReviewPayload({
      exam: { id: "exam-1", learning_exam_questions: [question("q2", 1), question("q1", 0)] },
      answers: [
        { question_id: "q1", user_answer: { selectedIndex: 1 } },
        { question_id: "q2", user_answer: { selectedIndex: 8 } },
        { question_id: "missing", user_answer: { selectedIndex: 0 } },
      ],
    });

    expect(result?.questions.map((item) => item.id)).toEqual(["q1", "q2"]);
    expect(result?.selectedAnswers).toEqual({ q1: 1 });
  });

  it("rejects malformed exam payloads", () => {
    expect(mapExamReviewPayload(null)).toBeNull();
    expect(mapExamReviewPayload({ exam: {} })).toBeNull();
  });
});
