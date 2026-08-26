import { StudyPlan } from './study-plan';
import { StudyGoal } from './learning-objective';

type MutableStudyPlan = { -readonly [P in keyof StudyPlan]: StudyPlan[P] };

export class StudyPlanBuilder {
  private plan: Partial<MutableStudyPlan> = {
    goals: [],
    recommendedAssets: [],
    reviewQueue: [],
    futureMilestones: [],
    completionState: 'Draft',
    estimatedDurationSeconds: 0,
    priority: 'Medium'
  };

  constructor(id: string, title: string) {
    this.plan.id = id;
    this.plan.title = title;
    this.plan.createdAt = new Date().toISOString();
    this.plan.updatedAt = this.plan.createdAt;
  }

  withGoals(goals: StudyGoal[]): this {
    this.plan.goals = goals;
    return this;
  }

  withRecommendedAssets(assetIds: string[]): this {
    this.plan.recommendedAssets = assetIds;
    return this;
  }

  withReviewQueue(queue: string[]): this {
    this.plan.reviewQueue = queue;
    return this;
  }

  withDuration(seconds: number): this {
    this.plan.estimatedDurationSeconds = seconds;
    return this;
  }

  build(): StudyPlan {
    if (!this.plan.id || !this.plan.title) {
      throw new Error('StudyPlan requires an ID and Title');
    }
    // Return a deeply frozen/immutable copy if we want strict enforcement,
    // but ReadonlyArray in TypeScript provides compile-time immutability.
    return Object.freeze({ ...this.plan }) as StudyPlan;
  }
}
