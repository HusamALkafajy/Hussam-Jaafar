import { Injectable, Logger } from '@nestjs/common';
import { RecommendationAnalyticsRepository } from './recommendation-analytics.repository';
import { 
  RecommendationAnalyticsEvent, 
  RuleEffectivenessMetrics 
} from '@studyai/domain';

@Injectable()
export class RecommendationAnalyticsService {
  private readonly logger = new Logger(RecommendationAnalyticsService.name);

  constructor(
    private readonly repository: RecommendationAnalyticsRepository
  ) {}

  /**
   * Publishes a recommendation analytics event to the immutable event store.
   * Swallows exceptions to ensure recommendation flow is never interrupted.
   */
  async publishEvent(event: RecommendationAnalyticsEvent): Promise<void> {
    try {
      await this.repository.insertEvent(event);
    } catch (error) {
      // Failure isolation: log the error but do not throw
      // This guarantees the analytics layer never brings down the main application
      this.logger.error(`Failed to publish recommendation analytics event: ${error}`);
    }
  }

  /**
   * Calculates effectiveness metrics dynamically based on raw events.
   * Satisfies constraint: "Do NOT store calculated metrics."
   */
  async getRuleEffectiveness(ruleIdentifier: string): Promise<RuleEffectivenessMetrics> {
    return this.repository.getRuleEffectivenessMetrics(ruleIdentifier);
  }
}
