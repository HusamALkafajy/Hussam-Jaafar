import { PlanningContext } from './planning-context';
import { StudyPlan } from './study-plan';
import { StudyPlanBuilder } from './study-plan-builder';
import { SessionPlanner } from './session-planner';
import { ReviewPlanner } from './review-planner';
import { PriorityCalculator } from './priority-calculator';
import { CompletionEvaluator } from './completion-evaluator';
import { RecommendationRanker } from './recommendation-ranker';

export class AdaptiveLearningOrchestrator {
  constructor(
    private sessionPlanner: SessionPlanner,
    private reviewPlanner: ReviewPlanner,
    private priorityCalculator: PriorityCalculator,
    private completionEvaluator: CompletionEvaluator,
    private recommendationRanker: RecommendationRanker
  ) {}

  generateStudyPlan(context: PlanningContext, planId: string, planTitle: string): StudyPlan {
    const builder = new StudyPlanBuilder(planId, planTitle);

    // 1. Rank Recommendations
    const rankedRecs = this.recommendationRanker.rank(context);
    builder.withRecommendedAssets(rankedRecs.map(r => r.targetResourceId).filter(id => id !== undefined) as string[]);

    // 2. Generate Review Queue
    const reviewQueue = this.reviewPlanner.planReviews(context);
    builder.withReviewQueue(reviewQueue);

    // 3. Plan Session Duration
    const duration = this.sessionPlanner.planSession(context);
    builder.withDuration(duration);

    // 4. Evaluate Goals Priorities & Completions (Assuming context.goals exist)
    const goals = context.goals || [];
    goals.forEach(goal => {
      goal.objectives.forEach(obj => {
        obj.priority = this.priorityCalculator.calculate(obj, context);
        if (this.completionEvaluator.evaluate(obj, context)) {
          obj.status = 'Completed';
        }
      });
    });
    builder.withGoals(goals);

    return builder.build();
  }
}
