import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db, flashcardSets, flashcards, eq, and, desc, sql } from '@studyai/database';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { CreateFlashcardSetDto } from './dto/create-flashcard-set.dto';
import { ReviewFlashcardDto } from './dto/review-flashcard.dto';
import { MasteryLevel } from '@studyai/types';

@Injectable()
export class FlashcardsService {
  constructor(
    private readonly filesService: FilesService,
    private readonly aiService: AiService,
  ) {}

  async create(userId: string, dto: CreateFlashcardSetDto) {
    const file = await this.filesService.findById(dto.fileId, userId);
    if (!file.extractedText) {
      throw new BadRequestException('File extracted text is missing. Re-upload or re-analyze.');
    }

    const count = dto.count || 10;

    // 1. Generate flashcards via Gemini API
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

    // 3. Save Cards
    const cardValues = cards.map((c: any) => ({
      setId: setRecord.id,
      front: c.front.trim(),
      back: c.back.trim(),
      reviewCount: 0,
      masteryLevel: MasteryLevel.NEW,
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

    // 2. Schedule next review based on Spaced Repetition mastery selection
    const nextReview = new Date();
    if (dto.masteryLevel === MasteryLevel.LEARNING) {
      nextReview.setDate(nextReview.getDate() + 1); // 1 day
    } else if (dto.masteryLevel === MasteryLevel.REVIEWING) {
      nextReview.setDate(nextReview.getDate() + 3); // 3 days
    } else if (dto.masteryLevel === MasteryLevel.MASTERED) {
      nextReview.setDate(nextReview.getDate() + 7); // 7 days
    } else {
      nextReview.setDate(nextReview.getDate() + 1); // fallback
    }

    // 3. Update Flashcard
    await db
      .update(flashcards)
      .set({
        masteryLevel: dto.masteryLevel,
        reviewCount: card.reviewCount + 1,
        nextReviewAt: nextReview,
      })
      .where(eq(flashcards.id, cardId));

    // 4. Update Set stats
    // Count mastered cards in this set
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

    return this.findById(set.id, userId);
  }
}
