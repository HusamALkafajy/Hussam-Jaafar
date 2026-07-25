import { Injectable, Logger } from '@nestjs/common';
import { db, exams, questions } from '@studyai/database';
import { eq, and } from 'drizzle-orm';
import { QuizQuestionAsset } from './engine/contracts/quiz';
import { LearningAsset } from '../learning-assets/contracts/learning-asset';

@Injectable()
export class QuizzesRepository {
  private readonly logger = new Logger(QuizzesRepository.name);

  async persistQuiz(
    fileId: string,
    userId: string,
    title: string,
    originGraphVersion: string,
    assets: LearningAsset<QuizQuestionAsset>[]
  ): Promise<void> {
    if (assets.length === 0) return;

    try {
      await db.transaction(async (tx) => {
        // Create the Exam (Quiz)
        const insertedExam = await tx
          .insert(exams)
          .values({
            fileId,
            userId,
            title,
            originGraphVersion,
            difficulty: 'medium', // Default for generated quizzes
            totalQuestions: assets.length,
            status: 'draft', // Generated quizzes start as draft or active
            adaptiveMode: false,
          })
          .returning({ id: exams.id });

        const examId = insertedExam[0].id;

        // Create the Questions
        const questionValues = assets.map((asset, index) => ({
          examId,
          type: asset.payload.type,
          questionText: asset.payload.front,
          options: asset.payload.options || null,
          correctAnswer: asset.payload.back,
          version: asset.payload.version,
          knowledgeNodeId: asset.payload.knowledgeNodeId,
          sourceReferences: JSON.stringify(asset.payload.sourceReferences),
          difficulty: 'medium' as const, // We cast to avoid enum issues, defaults in DB to 'medium'
          orderIndex: index,
          points: 1,
        }));

        await tx.insert(questions).values(questionValues);
      });
      
      this.logger.log(`Persisted ${assets.length} quiz questions to DB for file ${fileId}`);
    } catch (err) {
      this.logger.error(`Failed to persist quiz for file ${fileId}`, err);
      throw err; // Ensure failure bubbles up to avoid false positives!
    }
  }

  async getQuizzesByFileId(fileId: string, userId: string) {
    return db
      .select()
      .from(exams)
      .where(and(eq(exams.fileId, fileId), eq(exams.userId, userId)));
  }
}
