import { PlanningContext } from './planning-context';
import { RecommendationRankingPolicy } from './policies/recommendation-ranking-policy';
import { Recommendation } from '../recommendation';

export class RecommendationRanker {
  constructor(private rankingPolicy: RecommendationRankingPolicy) {}

  rank(context: PlanningContext): Recommendation[] {
    return this.rankingPolicy.rankRecommendations(context);
  }
}
