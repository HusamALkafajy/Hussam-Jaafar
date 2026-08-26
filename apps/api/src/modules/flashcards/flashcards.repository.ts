import { Injectable, Logger } from '@nestjs/common';
import { db, flashcardSets, flashcards, eq, and } from '@studyai/database';
import { LearningAsset } from '../learning-assets/contracts/learning-asset';
import { Flashcard } from './engine/contracts/flashcard';
import { MasteryLevel } from '@studyai/types';
import * as crypto from 'crypto';

@Injectable()
export class FlashcardsRepository {
  private readonly logger = new Logger(FlashcardsRepository.name);

  async saveGeneratedFlashcards(
    fileId: string, 
    userId: string, 
    assets: LearningAsset<Flashcard>[]
  ): Promise<void> {
    if (assets.length === 0) return;

    // Use a transaction to create the set and the cards
    await db.transaction(async (tx) => {
      // 1. Ensure a set exists or create a new one. 
      //    We can title it automatically or find an existing one for this file.
      const existingSets = await tx
        .select()
        .from(flashcardSets)
        .where(and(eq(flashcardSets.fileId, fileId), eq(flashcardSets.userId, userId)))
        .limit(1);

      let setId: string;

      if (existingSets.length > 0) {
        setId = existingSets[0].id;
        
        // Update total cards count and origin version
        await tx.update(flashcardSets)
          .set({ 
            totalCards: existingSets[0].totalCards + assets.length,
            originGraphVersion: assets[0].originGraphVersion
          })
          .where(eq(flashcardSets.id, setId));
      } else {
        const insertResult = await tx.insert(flashcardSets)
          .values({
            fileId,
            userId,
            title: `Generated Flashcards`,
            totalCards: assets.length,
            originGraphVersion: assets[0].originGraphVersion,
            masteredCount: 0,
            reviewCount: 0,
          })
          .returning();
        setId = insertResult[0].id;
      }

      // 2. Insert the cards
      const cardValues = assets.map(asset => {
        const payload = asset.payload;
        return {
          setId,
          front: payload.front,
          back: payload.back,
          cardType: payload.cardType,
          version: payload.version,
          knowledgeNodeId: payload.knowledgeNodeId,
          sourceReferences: JSON.stringify(payload.sourceReferences),
          reviewCount: 0,
          masteryLevel: MasteryLevel.NEW,
          easeFactor: 250,
          interval: 0,
          repetitions: 0,
        };
      });

      await tx.insert(flashcards).values(cardValues);
      this.logger.log(`Persisted ${assets.length} flashcards to DB for set ${setId}`);
    });
  }
}
