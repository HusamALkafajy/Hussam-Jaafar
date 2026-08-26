import { Injectable, Logger } from '@nestjs/common';
import { db } from '@studyai/database';
import { exams, flashcardSets, recommendationAnalytics, analytics } from '@studyai/database';
import { eq, desc, and, gte } from 'drizzle-orm';
import { LearnerProfile, ConceptMastery, ActivitySummary } from '@studyai/domain';

@Injectable()
export class LearnerProfileRepository {
  private readonly logger = new Logger(LearnerProfileRepository.name);

  async buildProfileForUser(userId: string): Promise<LearnerProfile> {
    this.logger.log(`Building LearnerProfile dynamically for user ${userId}`);

    // Fetch Quiz Data (Exams)
    const recentExams = await db.query.exams.findMany({
      where: eq(exams.userId, userId),
      orderBy: [desc(exams.createdAt)],
      limit: 10,
    });

    // Fetch Flashcard Performance
    const recentFlashcards = await db.query.flashcardSets.findMany({
      where: eq(flashcardSets.userId, userId),
      orderBy: [desc(flashcardSets.createdAt)],
      limit: 50,
    });

    // Fetch Analytics
    const recentAnalytics = await db.query.analytics.findFirst({
      where: eq(analytics.userId, userId),
      orderBy: [desc(analytics.date)],
    });

    // Heuristics for Strong/Weak concepts
    const conceptMasteryMap = new Map<string, { score: number; count: number }>();

    // Process Exam Weaknesses/Strengths
    // Since strengthAnalysis is stored as jsonb array of strings/objects, we'll parse it.
    recentExams.forEach((exam) => {
      if (exam.score !== null) {
        // Just a mock heuristic mapping for now, assuming strengthAnalysis contains concept names
        const strengths = (exam.strengthAnalysis as string[]) || [];
        const weaknesses = (exam.weaknessAnalysis as string[]) || [];

        strengths.forEach((concept) => {
          const existing = conceptMasteryMap.get(concept) || { score: 0, count: 0 };
          conceptMasteryMap.set(concept, { score: existing.score + 0.9, count: existing.count + 1 });
        });

        weaknesses.forEach((concept) => {
          const existing = conceptMasteryMap.get(concept) || { score: 0, count: 0 };
          conceptMasteryMap.set(concept, { score: existing.score + 0.3, count: existing.count + 1 });
        });
      }
    });

    // Compile Strong/Weak
    const strongConcepts: ConceptMastery[] = [];
    const weakConcepts: ConceptMastery[] = [];

    conceptMasteryMap.forEach((data, conceptId) => {
      const avgScore = data.score / data.count;
      const mastery: ConceptMastery = {
        conceptId,
        masteryScore: Math.min(avgScore, 1),
        confidence: Math.min(data.count * 0.2, 1), // Max confidence after 5 evaluations
        lastEvaluatedAt: new Date().toISOString(),
      };

      if (avgScore >= 0.7) strongConcepts.push(mastery);
      else weakConcepts.push(mastery);
    });

    // Default Profile
    return {
      userId,
      currentLevel: this.determineLevel(recentExams),
      preferredPace: 'Standard', // Could be fetched from user preferences
      strongConcepts,
      weakConcepts,
      recentActivity: {
        lastStudySession: recentAnalytics?.date || new Date().toISOString(),
        totalSessionsThisWeek: recentAnalytics?.studyMinutes ? 1 : 0, // Simplify for now
        averageSessionDurationMinutes: recentAnalytics?.studyMinutes || 0,
        learningStreakDays: recentAnalytics?.studyMinutes ? 1 : 0,
      },
      consistencyScore: recentAnalytics ? 0.8 : 0.2,
      updatedAt: new Date().toISOString(),
    };
  }

  private determineLevel(recentExams: any[]): 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' {
    if (recentExams.length < 3) return 'Beginner';
    const avgScore = recentExams.reduce((sum, e) => sum + Number(e.score || 0), 0) / recentExams.length;
    if (avgScore > 90) return 'Expert';
    if (avgScore > 75) return 'Advanced';
    return 'Intermediate';
  }
}
