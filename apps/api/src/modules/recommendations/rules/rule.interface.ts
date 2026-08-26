import { Recommendation, UserLearningContext } from '@studyai/domain';

export interface RecommendationRule {
  readonly id: string;
  readonly description: string;
  readonly priority: 'High' | 'Medium' | 'Low';

  /**
   * Evaluates the context and returns generated recommendations if eligible.
   * Returns an empty array if no recommendations apply.
   */
  evaluate(context: UserLearningContext): Recommendation[];
}
