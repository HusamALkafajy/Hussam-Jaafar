export interface LearningMetrics {
  readonly sessionDurationSeconds: number;
  readonly assetsGenerated: number;
  readonly assetsReviewed: number;
  readonly masteryScore: number; // 0.0 to 1.0
  readonly engagementScore: number; // 0.0 to 1.0
}
