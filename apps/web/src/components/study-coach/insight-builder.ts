import { StudyPlan } from '@studyai/domain/adaptive/study-plan';
import { PlanningContext } from '@studyai/domain/adaptive/planning-context';

export type InsightCategory = 
  | 'Focus'
  | 'Recommendation'
  | 'Progress'
  | 'Review'
  | 'Goal'
  | 'Timeline';

export interface InsightModel {
  id: string;
  category: InsightCategory;
  title: string;
  description?: string;
  payload?: any;
}

export class InsightBuilder {
  static buildInsights(plan?: StudyPlan, context?: PlanningContext): InsightModel[] {
    if (!plan) return [];

    const insights: InsightModel[] = [];

    // 1. Today's Focus
    insights.push({
      id: 'focus_1',
      category: 'Focus',
      title: "Today's Plan",
      description: `Estimated duration: ${Math.round(plan.estimatedDurationSeconds / 60)} minutes`,
      payload: { 
        duration: plan.estimatedDurationSeconds,
        newAssets: plan.recommendedAssets.length,
        reviews: plan.reviewQueue.length
      }
    });

    // 2. Active Goals
    if (plan.goals && plan.goals.length > 0) {
      plan.goals.forEach(goal => {
        if (goal.status !== 'Completed') {
          insights.push({
            id: `goal_${goal.id}`,
            category: 'Goal',
            title: goal.title,
            description: goal.description,
            payload: goal
          });
        }
      });
    }

    // 3. Recommendations
    if (context?.recommendations) {
      context.recommendations.forEach(rec => {
        insights.push({
          id: `rec_${rec.id}`,
          category: 'Recommendation',
          title: 'Suggested Next Step',
          description: rec.explanation,
          payload: rec
        });
      });
    }

    // 4. Progress Summary (Derived from context.session if present)
    if (context?.session) {
      insights.push({
        id: 'prog_1',
        category: 'Progress',
        title: 'Your Progress',
        description: `${Math.round(context.session.progress * 100)}% completed`,
        payload: { progress: context.session.progress }
      });
    }

    // 5. Review Reminder
    if (plan.reviewQueue && plan.reviewQueue.length > 0) {
      insights.push({
        id: 'rev_1',
        category: 'Review',
        title: 'Review Queue',
        description: `You have ${plan.reviewQueue.length} items to review`,
        payload: { queue: plan.reviewQueue }
      });
    }

    return insights;
  }
}
