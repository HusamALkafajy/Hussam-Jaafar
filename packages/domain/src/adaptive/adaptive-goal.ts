export type AdaptiveGoalType = 'FinishTopic' | 'ImproveWeakConcept' | 'IncreaseQuizPerformance' | 'ImproveRetention' | 'MaintainStreak';

export type AdaptiveGoalPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface AdaptiveGoal {
  id: string;
  userId: string;
  goalType: AdaptiveGoalType;
  objective: string;
  priority: AdaptiveGoalPriority;
  estimatedEffortMinutes: number;
  progressPercentage: number;
  evidence: string;      // The exact reason why this goal was generated
  targetConceptId?: string; // If this goal specifically targets a concept
  createdAt: string;     // ISO date
  updatedAt: string;     // ISO date
}
