import type { Flashcard, FlashcardReview } from "./types";

export type DueStudyFlashcard = Flashcard & { reviewId: string };

export function mapDueFlashcards(payload: unknown): DueStudyFlashcard[] {
  if (!payload || typeof payload !== "object") return [];
  const rows = (payload as { cards?: unknown }).cards;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): DueStudyFlashcard[] => {
    if (!row || typeof row !== "object") return [];
    const review = row as FlashcardReview & { learning_flashcards?: Flashcard | null };
    const card = review.learning_flashcards;
    if (!card || typeof card.id !== "string" || typeof review.id !== "string") return [];
    return [{ ...card, reviewId: review.id }];
  });
}
