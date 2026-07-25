import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { 
  recommendationAnalytics, 
  analytics, 
  studyTasks, 
  flashcards,
  db
} from '@studyai/database';
import { 
  RecommendationAnalyticsEvent, 
  RuleEffectivenessMetrics 
} from '@studyai/domain';

@Injectable()
export class RecommendationAnalyticsRepository {
  async insertEvent(event: RecommendationAnalyticsEvent): Promise<void> {
    await db.insert(recommendationAnalytics).values({
      userId: event.userId,
      recommendationId: event.recommendationId || null,
      ruleIdentifier: event.ruleIdentifier,
      recommendationType: event.recommendationType,
      action: event.action,
      context: event.context || null,
      createdAt: event.createdAt || new Date(),
    });
  }

  async getRuleEffectivenessMetrics(ruleIdentifier: string): Promise<RuleEffectivenessMetrics> {
    // Standard aggregation to prevent calculating metrics in the database
    // We fetch raw aggregate counts and compute rates in memory
    const result = await db
      .select({
        action: recommendationAnalytics.action,
        count: sql<number>`count(${recommendationAnalytics.id})`,
      })
      .from(recommendationAnalytics)
      .where(eq(recommendationAnalytics.ruleIdentifier, ruleIdentifier))
      .groupBy(recommendationAnalytics.action);

    const counts = {
      displayed: 0,
      clicked: 0,
      completed: 0,
    };

    result.forEach(row => {
      if (row.action === 'displayed') counts.displayed = Number(row.count);
      if (row.action === 'clicked') counts.clicked = Number(row.count);
      if (row.action === 'completed') counts.completed = Number(row.count);
    });

    const displayCount = counts.displayed;
    const clickCount = counts.clicked;
    const completionCount = counts.completed;

    const clickThroughRate = displayCount > 0 ? (clickCount / displayCount) * 100 : 0;
    const completionRate = displayCount > 0 ? (completionCount / displayCount) * 100 : 0;

    // Simple heuristic for effectiveness
    const effectivenessScore = (clickThroughRate * 0.4) + (completionRate * 0.6);

    return {
      ruleIdentifier,
      displayCount,
      clickCount,
      completionCount,
      clickThroughRate,
      completionRate,
      effectivenessScore,
    };
  }
}
