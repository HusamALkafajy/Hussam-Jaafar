import { PlanningContext } from './planning-context';
import { ReviewPolicy } from './policies/review-policy';

export class ReviewPlanner {
  constructor(private reviewPolicy: ReviewPolicy) {}

  planReviews(context: PlanningContext): string[] {
    return this.reviewPolicy.determineReviewQueue(context);
  }
}
