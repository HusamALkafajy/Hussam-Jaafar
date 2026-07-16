import { LearningSession } from '../learning-session';

export interface ProgressState {
  completedAssets: number;
  remainingAssets: number;
  reviewedAssets: number;
  studyStreakDays: number;
  sessionProgress: number;
}

export class ProgressTracker {
  // Pure projection, no mutation of session
  static calculateProgress(session?: LearningSession, totalAssets: number = 0): ProgressState {
    if (!session) {
      return {
        completedAssets: 0,
        remainingAssets: totalAssets,
        reviewedAssets: 0,
        studyStreakDays: 0,
        sessionProgress: 0
      };
    }

    const reviewed = session.metrics?.assetsReviewed || 0;
    const completed = Math.floor(session.progress * totalAssets);
    const remaining = Math.max(0, totalAssets - completed);

    return {
      completedAssets: completed,
      remainingAssets: remaining,
      reviewedAssets: reviewed,
      studyStreakDays: 1, // Mock derived value
      sessionProgress: session.progress
    };
  }
}
