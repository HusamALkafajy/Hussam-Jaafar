import { PlanningContext } from '../planning-context';
import { Recommendation } from '../../recommendation';

export interface RecommendationRankingPolicy {
  rankRecommendations(context: PlanningContext): Recommendation[];
}

export class DefaultRecommendationRankingPolicy implements RecommendationRankingPolicy {
  rankRecommendations(context: PlanningContext): Recommendation[] {
    if (!context.recommendations) return [];
    
    // Sort by priority string roughly, then by confidence
    const priorityWeight: Record<string, number> = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1
    };

    return [...context.recommendations].sort((a, b) => {
      const wA = priorityWeight[a.priority] || 0;
      const wB = priorityWeight[b.priority] || 0;
      if (wA !== wB) return wB - wA;
      return b.confidence - a.confidence;
    });
  }
}
