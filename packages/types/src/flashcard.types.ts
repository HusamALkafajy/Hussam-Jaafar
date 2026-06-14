export enum MasteryLevel {
  NEW = 'new',
  LEARNING = 'learning',
  REVIEWING = 'reviewing',
  MASTERED = 'mastered',
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
  createdAt: Date;
}

export interface CreateFlashcardSetDto {
  fileId: string;
  title?: string;
  count?: number;
}

export interface ReviewFlashcardDto {
  masteryLevel: MasteryLevel;
}
