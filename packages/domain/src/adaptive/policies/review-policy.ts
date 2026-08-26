import { PlanningContext } from '../planning-context';

export interface ReviewPolicy {
  determineReviewQueue(context: PlanningContext): string[];
}

export class DefaultReviewPolicy implements ReviewPolicy {
  determineReviewQueue(context: PlanningContext): string[] {
    if (!context.schedules) return [];
    
    const now = new Date().toISOString();
    return context.schedules
      .filter(s => s.nextReview <= now)
      .map(s => s.assetId);
  }
}
