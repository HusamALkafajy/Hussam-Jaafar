import { AnalyticsProjection } from '../store/analytics-projection';

export class ForecastAnalyzer {
  static analyze(projection: AnalyticsProjection) {
    return {
      predictedRetentionNextWeek: 0.85
    };
  }
}
