import { describe, expect, it } from "vitest";
import { mapDueFlashcards } from "./flashcards";

describe("mapDueFlashcards", () => {
  it("keeps the flashcard ID separate from its review ID", () => {
    const result = mapDueFlashcards({
      cards: [
        {
          id: "review-id",
          flashcard_id: "card-id",
          learning_flashcards: { id: "card-id", front: "Question", back: "Answer" },
        },
      ],
    });
    expect(result).toEqual([
      { id: "card-id", front: "Question", back: "Answer", reviewId: "review-id" },
    ]);
  });

  it("ignores malformed rows", () => {
    expect(
      mapDueFlashcards({ cards: [null, {}, { id: "review", learning_flashcards: null }] }),
    ).toEqual([]);
    expect(mapDueFlashcards(null)).toEqual([]);
  });
});
