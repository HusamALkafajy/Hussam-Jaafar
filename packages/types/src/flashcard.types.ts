export enum MasteryLevel {
  NEW = 'new',
  LEARNING = 'learning',
  REVIEWING = 'reviewing',
  MASTERED = 'mastered',
}

/**
 * SM-2 Quality Score (0–5).
 *
 * Represents how well the user recalled a flashcard during a review session.
 * Scores below 3 are considered failures and reset the repetition streak.
 *
 * 0 — Complete blackout; no recollection at all.
 * 1 — Incorrect response, but upon seeing the answer it was familiar.
 * 2 — Incorrect response, but the answer seemed easy to recall in hindsight.
 * 3 — Correct response recalled with serious difficulty.
 * 4 — Correct response recalled after a hesitation.
 * 5 — Perfect response with no hesitation.
 */
export enum SM2Quality {
  COMPLETE_BLACKOUT = 0,
  INCORRECT_REMEMBERED = 1,
  INCORRECT_EASY = 2,
  CORRECT_DIFFICULT = 3,
  CORRECT_WITH_HESITATION = 4,
  PERFECT = 5,
}

export interface FlashcardSet {
  id: string;
  fileId: string;
  userId: string;
  title: string;
  totalCards: number;
  masteredCount: number;
  reviewCount: number;
  lastReviewedAt?: Date | null;
  createdAt: Date;
}

export interface Flashcard {
  id: string;
  setId: string;
  front: string;
  back: string;
  reviewCount: number;
  masteryLevel: MasteryLevel;
  nextReviewAt?: Date | null;
  // SM-2 algorithm state (stored as integer × 100 to avoid float DB issues)
  easeFactor: number;  // EF × 100, e.g. 250 = 2.50
  interval: number;    // Last computed interval in days
  repetitions: number; // Consecutive successful review streak
  createdAt: Date;
}

export interface CreateFlashcardSetDto {
  fileId: string;
  title?: string;
  count?: number;
}

export interface ReviewFlashcardDto {
  masteryLevel: MasteryLevel;
  /** Optional SM-2 quality score (0–5). When provided, the SM-2 algorithm
   *  is used to compute nextReviewAt dynamically. When absent, falls back
   *  to the legacy fixed-interval logic. */
  quality?: SM2Quality;
}
