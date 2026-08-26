import { Injectable, Logger } from '@nestjs/common';
import { UserLearningContext } from '@studyai/domain';
import { db, exams, flashcards, flashcardSets, studyTasks } from '@studyai/database';
import { eq, and, desc, sql } from 'drizzle-orm';

@Injectable()
export class RecommendationContextBuilderProvider {
  private readonly logger = new Logger(RecommendationContextBuilderProvider.name);

  async buildContext(userId: string): Promise<UserLearningContext> {
    try {
      // 1. Fetch recent quizzes
      const recentExamRecords = await db
        .select({
          id: exams.id,
          score: exams.score,
          completedAt: exams.completedAt,
        })
        .from(exams)
        .where(
          and(
            eq(exams.userId, userId),
            eq(exams.status, 'completed')
          )
        )
        .orderBy(desc(exams.completedAt))
        .limit(3);

      const recentQuizzes = recentExamRecords.map(e => ({
        id: e.id,
        score: Number(e.score || 0),
        subjectId: '', // Ideally retrieved via join if strictly required
        completedAt: e.completedAt || new Date(),
      }));

      // 2. Count Due Flashcards
      const dueFlashcardRecords = await db
        .select({
          count: sql<number>`count(*)`
        })
        .from(flashcards)
        .innerJoin(flashcardSets, eq(flashcards.setId, flashcardSets.id))
        .where(
          and(
            eq(flashcardSets.userId, userId),
            sql`${flashcards.nextReviewAt} <= CURRENT_TIMESTAMP`
          )
        );
      
      const dueFlashcardsCount = Number(dueFlashcardRecords[0]?.count || 0);

      // 3. Last Accessed Resource (from studyTasks or similar table)
      // Since analytics/activity logs don't cleanly give "last accessed file" in the current strict schema,
      // we'll infer it from the most recently completed study task or exam.
      let lastAccessedResource = undefined;
      
      const recentTask = await db
        .select()
        .from(studyTasks)
        .where(
          and(
            eq(studyTasks.userId, userId),
            eq(studyTasks.status, 'completed')
          )
        )
        .orderBy(desc(studyTasks.completedAt))
        .limit(1);

      if (recentTask.length > 0 && recentTask[0].resourceId && recentTask[0].resourceType) {
        lastAccessedResource = {
          type: recentTask[0].resourceType as any,
          id: recentTask[0].resourceId,
          title: recentTask[0].title,
          accessedAt: recentTask[0].completedAt || new Date(),
        };
      }

      return {
        userId,
        recentQuizzes,
        dueFlashcardsCount,
        recentTutorSessions: [], // Could be fetched from chat history if needed, left empty for MVP simplicity
        lastAccessedResource,
      };
    } catch (error) {
      this.logger.error('Failed to build user learning context', error);
      // Gracefully handle failure: return an empty context to allow rules to safely skip
      return {
        userId,
        recentQuizzes: [],
        dueFlashcardsCount: 0,
        recentTutorSessions: [],
        lastAccessedResource: undefined,
      };
    }
  }
}
