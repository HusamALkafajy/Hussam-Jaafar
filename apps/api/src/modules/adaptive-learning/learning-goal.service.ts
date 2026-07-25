import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AdaptiveGoal, LearnerProfile } from '@studyai/domain';

@Injectable()
export class LearningGoalService {
  private readonly logger = new Logger(LearningGoalService.name);

  /**
   * Deterministically calculates learning goals based on the LearnerProfile state.
   * Goals are transient and generated on-the-fly when evidence is available.
   */
  generateGoals(profile: LearnerProfile): AdaptiveGoal[] {
    this.logger.debug(`Generating adaptive goals for user ${profile.userId}`);
    const goals: AdaptiveGoal[] = [];

    // 1. Maintain Streak Goal
    if (profile.recentActivity.learningStreakDays > 0) {
      goals.push({
        id: uuidv4(),
        userId: profile.userId,
        goalType: 'MaintainStreak',
        objective: 'Maintain your current learning streak',
        priority: 'Medium',
        estimatedEffortMinutes: 15,
        progressPercentage: 100, // They have the streak currently
        evidence: `You have a ${profile.recentActivity.learningStreakDays}-day study streak.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Improve Weak Concepts
    profile.weakConcepts.forEach((weakness) => {
      // High priority if mastery is very low and confidence is high
      const isCritical = weakness.masteryScore < 0.3 && weakness.confidence > 0.5;
      
      goals.push({
        id: uuidv4(),
        userId: profile.userId,
        goalType: 'ImproveWeakConcept',
        objective: 'Improve understanding of weak concept',
        priority: isCritical ? 'Critical' : 'High',
        estimatedEffortMinutes: 30,
        progressPercentage: weakness.masteryScore * 100,
        targetConceptId: weakness.conceptId,
        evidence: `Your recent quiz and flashcard performance indicates difficulty with this concept. Score: ${(weakness.masteryScore * 100).toFixed(0)}%`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // 3. Improve Retention
    if (profile.consistencyScore < 0.5) {
      goals.push({
        id: uuidv4(),
        userId: profile.userId,
        goalType: 'ImproveRetention',
        objective: 'Study more consistently to improve retention',
        priority: 'Medium',
        estimatedEffortMinutes: 60,
        progressPercentage: profile.consistencyScore * 100,
        evidence: 'Your study consistency score is low. Frequent, shorter sessions improve memory retention.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Sort by Priority
    const priorityWeights = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    goals.sort((a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]);

    return goals;
  }
}
