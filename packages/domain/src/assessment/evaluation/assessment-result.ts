export interface AssessmentFeedback {
  strengths: string[];
  weaknesses: string[];
  recommendedReviewIds: string[];
  suggestedNextActivity: string;
}

export interface AssessmentResult {
  readonly attemptId: string;
  readonly score: number;
  readonly accuracy: number;
  readonly completionRate: number;
  readonly feedback: AssessmentFeedback;
  readonly generatedAt: string;
}
