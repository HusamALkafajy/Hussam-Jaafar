export interface MasteryEstimate {
  conceptId: string;
  score: number;       // The estimated mastery score from 0 to 1
  confidence: number;  // Confidence in this estimate from 0 to 1
  evidence: string;    // Human readable evidence used for this calculation
  calculationMethod: 'Deterministic' | 'MachineLearning' | 'KnowledgeTracing';
}

export interface ProgressEvaluation {
  userId: string;
  overallProgress: number; // 0 to 1
  weeklyImprovement: number; // Rate of improvement compared to last week
  consistencyScore: number; // 0 to 1
  completedGoalsCount: number;
  explanation: string;
}
