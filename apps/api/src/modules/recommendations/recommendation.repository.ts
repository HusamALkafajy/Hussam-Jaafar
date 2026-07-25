import { Injectable, Logger } from '@nestjs/common';
import { db, studyRecommendations } from '@studyai/database';
import { Recommendation } from '@studyai/domain';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class RecommendationRepository {
  private readonly logger = new Logger(RecommendationRepository.name);

  /**
   * Maps abstract domain recommendation types to the strict DB enum.
   * DB Enum: 'lesson' | 'quiz' | 'review_document' | 'study_habit'
   */
  private mapDomainTypeToDbEnum(domainType: string): 'lesson' | 'quiz' | 'review_document' | 'study_habit' {
    switch (domainType) {
      case 'RetryQuiz':
        return 'quiz';
      case 'ReviewFlashcards':
      case 'RecentlyInterrupted':
      case 'ContinueSession':
        return 'study_habit';
      case 'AskTutor':
      case 'ContinueLearning':
        return 'lesson';
      case 'ReviewWeakConcepts':
        return 'review_document';
      default:
        return 'study_habit';
    }
  }

  async saveRecommendations(userId: string, recommendations: Recommendation[]): Promise<void> {
    if (recommendations.length === 0) {
      return;
    }

    try {
      // For MVP: We will overwrite pending recommendations to keep it fresh
      // In production, we'd probably merge or diff them.
      await db.delete(studyRecommendations).where(
        and(
          eq(studyRecommendations.userId, userId),
          eq(studyRecommendations.isApplied, false)
        )
      );

      const insertPayloads = recommendations.map(rec => ({
        userId,
        type: this.mapDomainTypeToDbEnum(rec.type),
        title: rec.type, // Human readable titles can be mapped in the presentation layer
        description: rec.explanation,
        resourceType: rec.targetResourceType || null,
        resourceId: rec.targetResourceId || null,
        isApplied: false,
        scoreImportance: rec.priority === 'High' ? 3 : rec.priority === 'Medium' ? 2 : 1,
      }));

      await db.insert(studyRecommendations).values(insertPayloads);
    } catch (error) {
      this.logger.error('Failed to save recommendations to DB', error);
      throw error;
    }
  }

  async getPendingRecommendations(userId: string): Promise<any[]> {
    return db
      .select()
      .from(studyRecommendations)
      .where(
        and(
          eq(studyRecommendations.userId, userId),
          eq(studyRecommendations.isApplied, false)
        )
      );
  }
}
