import { Injectable, Logger } from '@nestjs/common';
import { LearnerProfile, ProgressEvaluation } from '@studyai/domain';

@Injectable()
export class ProgressEvaluatorService {
  private readonly logger = new Logger(ProgressEvaluatorService.name);

  /**
   * Deterministically calculates progress metrics.
   */
  evaluateProgress(profile: LearnerProfile): ProgressEvaluation {
    this.logger.debug(`Evaluating progress for user ${profile.userId}`);

    // Simplified deterministic heuristic for overall progress
    // Assume each strong concept is worth 10 points
    const overallProgressScore = profile.strongConcepts.reduce((sum, c) => sum + c.masteryScore, 0);

    return {
      userId: profile.userId,
      overallProgress: Math.min(overallProgressScore / 100, 1), // Normalized
      weeklyImprovement: profile.recentActivity.totalSessionsThisWeek > 0 ? 0.05 : 0, 
      consistencyScore: profile.consistencyScore,
      completedGoalsCount: 0, // This would normally query a completed goals table/event stream
      explanation: `Calculated deterministically based on ${profile.strongConcepts.length} strong concept(s) and recent study frequency.`,
    };
  }
}
