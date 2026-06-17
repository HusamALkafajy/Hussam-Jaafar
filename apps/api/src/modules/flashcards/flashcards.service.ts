import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db, flashcardSets, flashcards, eq, and, desc, sql } from '@studyai/database';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { GamificationService } from '../study-coach/gamification.service';
import { CreateFlashcardSetDto } from './dto/create-flashcard-set.dto';
import { ReviewFlashcardDto } from './dto/review-flashcard.dto';
import { MasteryLevel } from '@studyai/types';

// ---------------------------------------------------------------------------
// SM-2 Spaced Repetition Algorithm
// ---------------------------------------------------------------------------

/**
 * Result of a single SM-2 computation.
 */
interface SM2Result {
  /** New ease factor × 100 (stored as integer; min floor: 130 = 1.30) */
  easeFactor: number;
  /** Next interval in days */
  interval: number;
  /** Updated repetition streak */
  repetitions: number;
  /** Absolute date for the next review */
  nextReviewAt: Date;
}

/**
 * Pure implementation of the SuperMemo-2 (SM-2) algorithm.
 *
 * @param quality     — User's recall quality rating (0–5). Values < 3 are failures.
 * @param prevEF      — Previous ease factor × 100 (e.g. 250 = 2.5). Default 250.
 * @param prevInterval — Previous interval in days. Default 0.
 * @param prevReps    — Previous consecutive successful streak. Default 0.
 *
 * SM-2 rules:
 *   • quality >= 3 (success):
 *       – repetitions == 0 → interval = 1
 *       – repetitions == 1 → interval = 6
 *       – repetitions >= 2 → interval = round(prev_interval × EF)
 *       – EF'  = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
 *       – EF'  ≥ 1.30 (floor)
 *       – repetitions += 1
 *   • quality < 3 (failure):
 *       – repetitions = 0, interval = 1 (reset streak, review tomorrow)
 *       – EF unchanged
 */
function calculateSM2(
  quality: number,
  prevEF = 250,
  prevInterval = 0,
  prevReps = 0,
): SM2Result {
  const EF = prevEF / 100; // Convert stored integer back to float for calculation

  let newEF: number;
  let newInterval: number;
  let newReps: number;

  if (quality >= 3) {
    // Success path
    if (prevReps === 0) {
      newInterval = 1;
    } else if (prevReps === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(prevInterval * EF);
    }

    // Update ease factor: EF' = EF + 0.1 − (5 − q) × (0.08 + (5 − q) × 0.02)
    const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    newEF = Math.max(1.3, EF + delta);
    newReps = prevReps + 1;
  } else {
    // Failure path — reset streak, review again tomorrow
    newInterval = 1;
    newEF = EF; // EF is NOT penalised on failure in the original SM-2 spec
    newReps = 0;
  }

  // Store EF as integer × 100 to avoid float precision issues in the DB
  const newEFStored = Math.round(newEF * 100);

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

  return {
    easeFactor: newEFStored,
    interval: newInterval,
    repetitions: newReps,
    nextReviewAt,
  };
}

/**
 * Map an SM-2 quality score to the legacy MasteryLevel enum so the
 * frontend can continue displaying mastery badges without changes.
 */
function qualityToMasteryLevel(quality: number): MasteryLevel {
  if (quality <= 2) return MasteryLevel.LEARNING;
  if (quality === 3) return MasteryLevel.REVIEWING;
  return MasteryLevel.MASTERED; // quality 4 or 5
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class FlashcardsService {
  constructor(
    private readonly filesService: FilesService,
    private readonly aiService: AiService,
    private readonly gamificationService: GamificationService,
  ) {}

  async create(userId: string, dto: CreateFlashcardSetDto) {
    const file = await this.filesService.findById(dto.fileId, userId);
    if (!file.extractedText) {
      throw new BadRequestException('File extracted text is missing. Re-upload or re-analyze.');
    }

    const count = dto.count || 10;

    // 1. Generate flashcards via the configured AI provider
    const generated = await this.aiService.generateFlashcards(file.extractedText, count);
    const title = dto.title || generated.title || `بطاقات: ${file.originalName}`;
    const cards = generated.cards || [];

    if (cards.length === 0) {
      throw new BadRequestException('Failed to generate flashcards. Try again.');
    }

    // 2. Save Set
    const setResult = await db
      .insert(flashcardSets)
      .values({
        fileId: file.id,
        userId,
        title,
        totalCards: cards.length,
        masteredCount: 0,
        reviewCount: 0,
      })
      .returning();

    const setRecord = setResult[0];

    // 3. Save Cards (SM-2 fields initialise to their Drizzle schema defaults)
    const cardValues = cards.map((c: any) => ({
      setId: setRecord.id,
      front: c.front.trim(),
      back: c.back.trim(),
      reviewCount: 0,
      masteryLevel: MasteryLevel.NEW,
      // SM-2 defaults
      easeFactor: 250, // 2.50
      interval: 0,
      repetitions: 0,
    }));

    await db.insert(flashcards).values(cardValues);

    return this.findById(setRecord.id, userId);
  }

  async findAll(userId: string) {
    return db
      .select()
      .from(flashcardSets)
      .where(eq(flashcardSets.userId, userId))
      .orderBy(desc(flashcardSets.createdAt));
  }

  async findById(id: string, userId: string) {
    const setResult = await db
      .select()
      .from(flashcardSets)
      .where(and(eq(flashcardSets.id, id), eq(flashcardSets.userId, userId)))
      .limit(1);

    if (setResult.length === 0) {
      throw new NotFoundException('Flashcard set not found');
    }

    const setRecord = setResult[0];

    const cardsList = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.setId, setRecord.id))
      .orderBy(flashcards.createdAt);

    return {
      ...setRecord,
      cards: cardsList,
    };
  }

  async reviewCard(cardId: string, userId: string, dto: ReviewFlashcardDto) {
    // 1. Verify card ownership through its set
    const cardQuery = await db
      .select({
        card: flashcards,
        set: flashcardSets,
      })
      .from(flashcards)
      .innerJoin(flashcardSets, eq(flashcards.setId, flashcardSets.id))
      .where(and(eq(flashcards.id, cardId), eq(flashcardSets.userId, userId)))
      .limit(1);

    if (cardQuery.length === 0) {
      throw new NotFoundException('Flashcard not found');
    }

    const { card, set } = cardQuery[0];

    // 2. Determine mastery level and next review date
    let masteryLevel: MasteryLevel;
    let nextReviewAt: Date;
    let easeFactorUpdate: number = card.easeFactor;
    let intervalUpdate: number = card.interval;
    let repetitionsUpdate: number = card.repetitions;

    if (dto.quality !== undefined) {
      // --- SM-2 Path: dynamic, adaptive scheduling ---
      const sm2 = calculateSM2(
        dto.quality,
        card.easeFactor,
        card.interval,
        card.repetitions,
      );
      nextReviewAt = sm2.nextReviewAt;
      easeFactorUpdate = sm2.easeFactor;
      intervalUpdate = sm2.interval;
      repetitionsUpdate = sm2.repetitions;
      masteryLevel = qualityToMasteryLevel(dto.quality);
    } else {
      // --- Legacy Path: fixed-interval schedule (backward compatible) ---
      masteryLevel = dto.masteryLevel;
      nextReviewAt = new Date();
      if (masteryLevel === MasteryLevel.LEARNING) {
        nextReviewAt.setDate(nextReviewAt.getDate() + 1); // 1 day
      } else if (masteryLevel === MasteryLevel.REVIEWING) {
        nextReviewAt.setDate(nextReviewAt.getDate() + 3); // 3 days
      } else if (masteryLevel === MasteryLevel.MASTERED) {
        nextReviewAt.setDate(nextReviewAt.getDate() + 7); // 7 days
      } else {
        nextReviewAt.setDate(nextReviewAt.getDate() + 1); // fallback
      }
    }

    // 3. Update Flashcard with new SM-2 state and scheduling
    await db
      .update(flashcards)
      .set({
        masteryLevel,
        reviewCount: card.reviewCount + 1,
        nextReviewAt,
        easeFactor: easeFactorUpdate,
        interval: intervalUpdate,
        repetitions: repetitionsUpdate,
      })
      .where(eq(flashcards.id, cardId));

    // 4. Update Set stats — recount mastered cards
    const masteredQuery = await db
      .select({ count: sql<number>`count(*)` })
      .from(flashcards)
      .where(and(eq(flashcards.setId, set.id), eq(flashcards.masteryLevel, MasteryLevel.MASTERED)));

    const masteredCount = masteredQuery[0]?.count || 0;

    await db
      .update(flashcardSets)
      .set({
        masteredCount,
        reviewCount: set.reviewCount + 1,
        lastReviewedAt: new Date(),
      })
      .where(eq(flashcardSets.id, set.id));

    // Award gamification challenge progress for flashcard review (fire-and-forget)
    this.gamificationService
      .updateChallengeProgress(userId, 'flashcard', 1)
      .catch(() => {/* silently ignore gamification errors */});

    return this.findById(set.id, userId);
  }
}
