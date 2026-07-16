import { AnalyticsProjection } from '../store/analytics-projection';

export class ConsistencyAnalyzer {
  static analyze(projection: AnalyticsProjection) {
    const study = projection.getStudyTimeActivity();
    
    // Simplistic streak calculation
    const uniqueDays = new Set(study.dates.map(d => d.split('T')[0])).size;
    
    return {
      activeDays: uniqueDays,
      consistencyScore: Math.min(1.0, uniqueDays / 7)
    };
  }
}
