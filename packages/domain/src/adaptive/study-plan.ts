import { StudyGoal, GoalPriority } from './learning-objective';

export type PlanState = 'Draft' | 'Active' | 'Completed' | 'Archived';

export interface StudyPlan {
  readonly id: string;
  readonly title: string;
  readonly goals: ReadonlyArray<StudyGoal>;
  readonly recommendedAssets: ReadonlyArray<string>;
  readonly estimatedDurationSeconds: number;
  readonly completionState: PlanState;
  readonly priority: GoalPriority;
  readonly reviewQueue: ReadonlyArray<string>;
  readonly futureMilestones: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
}
