import { GoalPriority } from '@studyai/domain/adaptive/learning-objective';

export const MOCK_PRIORITY_MODEL: Record<GoalPriority, number> = {
  Critical: 100,
  High: 75,
  Medium: 50,
  Low: 25,
  Dynamic: 0
};
