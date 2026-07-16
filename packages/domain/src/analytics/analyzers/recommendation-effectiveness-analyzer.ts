import { AnalyticsProjection } from '../store/analytics-projection';

export class RecommendationEffectivenessAnalyzer {
  static analyze(projection: AnalyticsProjection) {
    const accepted = projection.getRawEvents().filter(e => e.type === 'recommendation.accepted').length;
    const rejected = projection.getRawEvents().filter(e => e.type === 'recommendation.rejected').length;
    const total = accepted + rejected;

    return {
      adoptionRate: total > 0 ? accepted / total : 0
    };
  }
}
