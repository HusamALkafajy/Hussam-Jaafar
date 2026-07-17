import { DifficultyLevel } from '@studyai/domain/learning-asset';

export const MOCK_DIFFICULTY_MODEL: Record<DifficultyLevel, { multiplier: number; label: string }> = {
  Easy: { multiplier: 1.0, label: 'Easy' },
  Medium: { multiplier: 1.5, label: 'Medium' },
  Hard: { multiplier: 2.0, label: 'Hard' },
  Adaptive: { multiplier: 1.0, label: 'Adaptive' }
};
