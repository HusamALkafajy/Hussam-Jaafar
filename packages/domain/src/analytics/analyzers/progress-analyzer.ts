import { AnalyticsProjection } from '../store/analytics-projection';

export class ProgressAnalyzer {
  static analyze(projection: AnalyticsProjection) {
    const act = projection.getAssessmentActivity();
    
    // In a real implementation, we would compare completed vs expected to get a true completionRate.
    // For now, we mock it based on total assessments taken.
    const completionRate = Math.min(1.0, act.totalAssessments / 10);
    
    return {
      completionRate,
      totalAssessments: act.totalAssessments,
      averageAccuracy: act.averageAccuracy
    };
  }
}
