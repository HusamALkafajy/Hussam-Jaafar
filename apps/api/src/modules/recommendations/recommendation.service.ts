import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { db, predictiveInsights, studyRecommendations, subjects, files, exams, questions, eq, and, desc, sql } from '@studyai/database';
import { AiService } from '../ai/ai.service';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly aiService: AiService) {}

  // 1. Generate Predictive AI insights for a subject
  async generatePredictiveInsights(userId: string, subjectId: string) {
    const subjectResult = await db
      .select()
      .from(subjects)
      .where(
        and(
          eq(subjects.id, subjectId),
          eq(subjects.userId, userId)
        )
      )
      .limit(1);

    if (subjectResult.length === 0) {
      throw new NotFoundException('Subject not found');
    }

    const subject = subjectResult[0];

    // Gather history: join exams to files to filter by subject
    const examRecords = await db
      .select({
        examId: exams.id,
        score: exams.score,
        totalQuestions: exams.totalQuestions,
      })
      .from(exams)
      .innerJoin(files, eq(exams.fileId, files.id))
      .where(
        and(
          eq(exams.userId, userId),
          eq(files.subjectId, subjectId),
          eq(exams.status, 'completed')
        )
      );

    // Compute basic statistics
    const totalExams = examRecords.length;
    let avgScore = 0;
    let totalQuestions = 0;
    let correctAnswers = 0;

    if (totalExams > 0) {
      const scoresSum = examRecords.reduce((sum, rec) => sum + Number(rec.score || 0), 0);
      avgScore = scoresSum / totalExams;

      const examIds = examRecords.map((r) => r.examId);
      const questionRecords = await db
        .select({
          isCorrect: questions.isCorrect,
        })
        .from(questions)
        .where(
          sql`exam_id IN ${examIds}`
        );

      totalQuestions = questionRecords.length;
      correctAnswers = questionRecords.filter((q) => q.isCorrect).length;
    }

    // Call AI to compute predictions & recommendations
    const systemPrompt = `You are a Predictive AI Study Analytics engine. Analyze student performance metrics and predict success probabilities.
Return the result strictly as a raw JSON object with the following fields:
- predictedScore: Predicted next exam score (decimal between 0.00 and 100.00).
- successProbability: Probability of passing/scoring >70% (decimal between 0.00 and 1.00).
- riskLevel: Categorized risk ('low', 'medium', 'high').
- recommendations: Array of 2-3 specific study habits or actions to take to improve.

Do not write markdown formatting (like \`\`\`json) or any wrapper text. Just the raw JSON string.`;

    const userPrompt = `Analyze performance for Subject: "${subject.name}".
Metrics:
- Total exams taken: ${totalExams}
- Average score: ${avgScore.toFixed(2)}%
- Total questions answered: ${totalQuestions}
- Correct answers: ${correctAnswers} (Success Rate: ${totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(2) : 0}%)`;

    let aiResult = {
      predictedScore: 60.0,
      successProbability: 0.5,
      riskLevel: 'high' as 'low' | 'medium' | 'high',
      recommendations: ['No study logs found. Upload documents and take quizzes to start tracking performance.'],
    };

    try {
      const completionText = await this.aiService.getCompletion(userPrompt, systemPrompt, true);
      const parsed = JSON.parse(completionText || '{}');
      if (parsed.predictedScore !== undefined) {
        aiResult = {
          predictedScore: Number(parsed.predictedScore),
          successProbability: Number(parsed.successProbability),
          riskLevel: parsed.riskLevel || 'medium',
          recommendations: parsed.recommendations || [],
        };
      }
    } catch (e) {
      this.logger.warn('Predictive AI generation failed, using statistical fallbacks:', e);
      // Fallback heuristics
      if (totalExams > 0) {
        const passProb = avgScore >= 70 ? 0.7 + (avgScore - 70) * 0.01 : (avgScore / 100) * 0.8;
        aiResult = {
          predictedScore: avgScore,
          successProbability: Math.min(Math.max(passProb, 0), 1),
          riskLevel: avgScore >= 80 ? 'low' : avgScore >= 60 ? 'medium' : 'high',
          recommendations: [
            `Continue taking practice exams for ${subject.name} to build confidence.`,
            avgScore < 70 ? `Re-study document summaries where score was below 70%.` : `Focus on reviewing difficult quiz questions.`
          ],
        };
      }
    }

    // Save insight
    const existingInsight = await db
      .select()
      .from(predictiveInsights)
      .where(
        and(
          eq(predictiveInsights.userId, userId),
          eq(predictiveInsights.subjectId, subjectId)
        )
      )
      .limit(1);

    let savedRecord;
    if (existingInsight.length > 0) {
      const updated = await db
        .update(predictiveInsights)
        .set({
          predictedScore: aiResult.predictedScore.toString(),
          successProbability: aiResult.successProbability.toString(),
          riskLevel: aiResult.riskLevel,
          recommendations: aiResult.recommendations,
          calculatedAt: new Date(),
        })
        .where(eq(predictiveInsights.id, existingInsight[0].id))
        .returning();
      savedRecord = updated[0];
    } else {
      const inserted = await db
        .insert(predictiveInsights)
        .values({
          userId,
          subjectId,
          predictedScore: aiResult.predictedScore.toString(),
          successProbability: aiResult.successProbability.toString(),
          riskLevel: aiResult.riskLevel,
          recommendations: aiResult.recommendations,
        })
        .returning();
      savedRecord = inserted[0];
    }

    // Add study recommendations based on insights
    for (const rec of aiResult.recommendations) {
      await db.insert(studyRecommendations).values({
        userId,
        subjectId,
        type: 'lesson',
        title: `Improve ${subject.name}`,
        description: rec,
        isApplied: false,
        scoreImportance: aiResult.riskLevel === 'high' ? 3 : aiResult.riskLevel === 'medium' ? 2 : 1,
      });
    }

    return savedRecord;
  }

  // 2. Fetch predictive insights
  async getPredictiveInsights(userId: string) {
    return db
      .select({
        id: predictiveInsights.id,
        subjectId: predictiveInsights.subjectId,
        subjectName: subjects.name,
        predictedScore: predictiveInsights.predictedScore,
        successProbability: predictiveInsights.successProbability,
        riskLevel: predictiveInsights.riskLevel,
        recommendations: predictiveInsights.recommendations,
        calculatedAt: predictiveInsights.calculatedAt,
      })
      .from(predictiveInsights)
      .innerJoin(subjects, eq(predictiveInsights.subjectId, subjects.id))
      .where(eq(predictiveInsights.userId, userId))
      .orderBy(desc(predictiveInsights.calculatedAt));
  }

  // 3. Get personalized recommendations
  async getRecommendations(userId: string) {
    // Fetch from recommendation table
    const stored = await db
      .select()
      .from(studyRecommendations)
      .where(
        and(
          eq(studyRecommendations.userId, userId),
          eq(studyRecommendations.isApplied, false)
        )
      )
      .orderBy(desc(studyRecommendations.scoreImportance))
      .limit(10);

    if (stored.length > 0) {
      return stored;
    }

    // Fallback static recommendation if empty
    return [
      {
        id: 'rec-default-1',
        userId,
        subjectId: null,
        type: 'study_habit',
        title: 'Build your study scheduler',
        description: 'Create a new study plan with your subject exams to organize daily tasks and track XP.',
        isApplied: false,
        scoreImportance: 1,
        createdAt: new Date(),
      },
      {
        id: 'rec-default-2',
        userId,
        subjectId: null,
        type: 'quiz',
        title: 'Review your first document',
        description: 'Upload a textbook PDF or image and generate a custom AI quiz to calculate your strength indicators.',
        isApplied: false,
        scoreImportance: 1,
        createdAt: new Date(),
      }
    ];
  }
}
