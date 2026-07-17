import { LearningObjective } from '@studyai/domain/adaptive/learning-objective';

export const MOCK_LEARNING_OBJECTIVES: LearningObjective[] = [
  {
    id: 'obj_1',
    title: 'Master Cell Division',
    description: 'Understand Mitosis and Meiosis',
    targetAssets: ['asset_1', 'asset_2'],
    completionCriteria: { minScore: 0.8 },
    status: 'InProgress',
    priority: 'High',
    tasks: []
  }
];
