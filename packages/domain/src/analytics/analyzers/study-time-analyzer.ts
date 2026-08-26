import { AnalyticsProjection } from '../store/analytics-projection';

export class StudyTimeAnalyzer {
  static analyze(projection: AnalyticsProjection) {
    const study = projection.getStudyTimeActivity();
    const uniqueDays = new Set(study.dates.map(d => d.split('T')[0])).size;

    return {
      totalTime: study.totalStudyTimeSeconds,
      streakDays: uniqueDays
    };
  }
}
