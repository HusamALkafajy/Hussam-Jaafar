import { AnalyticsSnapshot } from '../analytics-snapshot';

export type ReportType = 'Daily' | 'Weekly' | 'Monthly' | 'Subject' | 'Goal' | 'Revision' | 'Assessment';

export interface AnalyticsReport {
  readonly id: string;
  readonly type: ReportType;
  readonly generatedAt: string;
  readonly snapshot: AnalyticsSnapshot;
  readonly summary: string;
}

export class AnalyticsReportBuilder {
  static buildDailyReport(snapshot: AnalyticsSnapshot): AnalyticsReport {
    return {
      id: `rep_daily_${Date.now()}`,
      type: 'Daily',
      generatedAt: new Date().toISOString(),
      snapshot,
      summary: `Daily Summary: ${snapshot.studyTime.totalSeconds / 60} mins studied, ${snapshot.retention.totalRevisions} items reviewed.`
    };
  }

  static buildWeeklyReport(snapshot: AnalyticsSnapshot): AnalyticsReport {
    return {
      id: `rep_weekly_${Date.now()}`,
      type: 'Weekly',
      generatedAt: new Date().toISOString(),
      snapshot,
      summary: `Weekly Summary: ${snapshot.goals.completedGoals} goals completed, ${snapshot.consistency.activeDays} active days.`
    };
  }
}
