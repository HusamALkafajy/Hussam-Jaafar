import { StudyPlan } from '@studyai/domain/adaptive/study-plan';

export const MOCK_STUDY_PLANS: StudyPlan[] = [
  {
    id: 'plan_1',
    title: 'Biology 101 Midterm Prep',
    goals: [],
    recommendedAssets: ['asset_1', 'asset_2'],
    estimatedDurationSeconds: 3600,
    completionState: 'Active',
    priority: 'High',
    reviewQueue: ['asset_3'],
    futureMilestones: ['mile_1'],
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z'
  }
];
