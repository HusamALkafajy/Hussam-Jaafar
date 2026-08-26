import { ReviewSchedule } from '@studyai/domain/review-schedule';

export const MOCK_REVIEW_SCHEDULE: ReviewSchedule[] = [
  {
    assetId: 'asset_1',
    reviewStage: 1,
    nextReview: '2026-07-02T10:00:00Z',
    intervalMinutes: 1440
  }
];
