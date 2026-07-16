import { AnalyticsInsight } from './analytics-insight';

export class AnalyticsInsightBuilder {
  static buildProgressInsights(progressScore: number): AnalyticsInsight[] {
    if (progressScore > 0.8) {
      return [{
        id: `ins_${Date.now()}_progress_high`,
        title: 'Excellent Progress',
        description: 'You are consistently completing study sessions and assessments.',
        severity: 'Low',
        confidence: 0.9,
        category: 'Strength',
        source: 'ProgressAnalyzer'
      }];
    }
    
    if (progressScore < 0.4) {
      return [{
        id: `ins_${Date.now()}_progress_low`,
        title: 'Falling Behind',
        description: 'Your completion rate for scheduled sessions has dropped recently.',
        severity: 'High',
        confidence: 0.8,
        category: 'Risk',
        recommendation: 'Try to dedicate 15 minutes today to clear overdue revisions.',
        source: 'ProgressAnalyzer'
      }];
    }

    return [];
  }

  static buildRetentionInsights(retentionAccuracy: number): AnalyticsInsight[] {
    if (retentionAccuracy < 0.6) {
      return [{
        id: `ins_${Date.now()}_retention_low`,
        title: 'Low Memory Retention',
        description: 'You are forgetting items faster than expected.',
        severity: 'Medium',
        confidence: 0.85,
        category: 'Weakness',
        recommendation: 'Increase your review frequency or reduce the number of new items.',
        source: 'RetentionAnalyzer'
      }];
    }

    return [];
  }
}
