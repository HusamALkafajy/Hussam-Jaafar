import { AnalyticsProjection } from '../store/analytics-projection';

export class RetentionAnalyzer {
  static analyze(projection: AnalyticsProjection) {
    const rev = projection.getRevisionActivity();
    
    return {
      totalRevisions: rev.totalRevisions,
      averageAccuracy: rev.averageAccuracy,
      retentionTransitions: rev.retentionTransitions
    };
  }
}
