export interface AnalyticsSnapshot {
  readonly id: string;
  readonly generatedAt: string;
  readonly progress: {
    readonly overallCompletionRate: number;
    readonly totalAssessments: number;
    readonly averageAssessmentAccuracy: number;
  };
  readonly retention: {
    readonly totalRevisions: number;
    readonly averageRevisionAccuracy: number;
  };
  readonly studyTime: {
    readonly totalSeconds: number;
    readonly streakDays: number;
  };
  readonly goals: {
    readonly completedGoals: number;
  };
  readonly consistency: {
    readonly activeDays: number;
    readonly consistencyScore: number;
  };
  readonly recommendation: {
    readonly adoptionRate: number;
  };
}
