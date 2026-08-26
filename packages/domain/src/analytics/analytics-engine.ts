import { AnalyticsProjection } from './store/analytics-projection';
import { AnalyticsSnapshot } from './analytics-snapshot';
import { AnalyticsQuery } from './analytics-query';
import { AnalyticsInsight } from './analytics-insight';
import { AnalyticsInsightBuilder } from './analytics-insight-builder';

// We'll import individual analyzers here
import { ProgressAnalyzer } from './analyzers/progress-analyzer';
import { RetentionAnalyzer } from './analyzers/retention-analyzer';
import { StudyTimeAnalyzer } from './analyzers/study-time-analyzer';
import { GoalAnalyzer } from './analyzers/goal-analyzer';
import { ConsistencyAnalyzer } from './analyzers/consistency-analyzer';
import { RecommendationEffectivenessAnalyzer } from './analyzers/recommendation-effectiveness-analyzer';

export class AnalyticsEngine implements AnalyticsQuery {
  constructor(private projection: AnalyticsProjection) {}

  getSnapshot(): AnalyticsSnapshot {
    const progressResult = ProgressAnalyzer.analyze(this.projection);
    const retentionResult = RetentionAnalyzer.analyze(this.projection);
    const studyTimeResult = StudyTimeAnalyzer.analyze(this.projection);
    const goalResult = GoalAnalyzer.analyze(this.projection);
    const consistencyResult = ConsistencyAnalyzer.analyze(this.projection);
    const recommendationResult = RecommendationEffectivenessAnalyzer.analyze(this.projection);

    return {
      id: `snap_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      progress: {
        overallCompletionRate: progressResult.completionRate,
        totalAssessments: progressResult.totalAssessments,
        averageAssessmentAccuracy: progressResult.averageAccuracy
      },
      retention: {
        totalRevisions: retentionResult.totalRevisions,
        averageRevisionAccuracy: retentionResult.averageAccuracy
      },
      studyTime: {
        totalSeconds: studyTimeResult.totalTime,
        streakDays: studyTimeResult.streakDays
      },
      goals: {
        completedGoals: goalResult.completedCount
      },
      consistency: {
        activeDays: consistencyResult.activeDays,
        consistencyScore: consistencyResult.consistencyScore
      },
      recommendation: {
        adoptionRate: recommendationResult.adoptionRate
      }
    };
  }

  getInsights(): AnalyticsInsight[] {
    const snapshot = this.getSnapshot();
    
    const progressInsights = AnalyticsInsightBuilder.buildProgressInsights(snapshot.progress.overallCompletionRate);
    const retentionInsights = AnalyticsInsightBuilder.buildRetentionInsights(snapshot.retention.averageRevisionAccuracy);
    
    return [...progressInsights, ...retentionInsights];
  }
}
