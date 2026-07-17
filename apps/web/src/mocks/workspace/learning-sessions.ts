import { LearningSession } from '@studyai/domain/learning-session';

export const MOCK_LEARNING_SESSIONS: LearningSession[] = [
  {
    id: 'session_1',
    documentId: 'doc_1',
    assets: ['asset_1'],
    progress: 0.5,
    history: ['evt_1'],
    metrics: {
      sessionDurationSeconds: 120,
      assetsGenerated: 1,
      assetsReviewed: 1,
      masteryScore: 0.8,
      engagementScore: 0.9
    },
    recommendations: []
  }
];
