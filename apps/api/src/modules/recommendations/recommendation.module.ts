import { Module } from '@nestjs/common';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { RecommendationRepository } from './recommendation.repository';
import { RecommendationContextBuilderProvider } from './providers/recommendation-context-builder.provider';
import { RecommendationExplanationProvider } from './providers/recommendation-explanation.provider';
import { RuleEvaluationPipeline } from './pipeline/rule-evaluation.pipeline';
import { RecommendationAnalyticsService } from './analytics/recommendation-analytics.service';
import { RecommendationAnalyticsRepository } from './analytics/recommendation-analytics.repository';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    RecommendationRepository,
    RecommendationContextBuilderProvider,
    RecommendationExplanationProvider,
    RuleEvaluationPipeline,
    RecommendationAnalyticsService,
    RecommendationAnalyticsRepository,
  ],
  exports: [RecommendationService, RecommendationAnalyticsService],
})
export class RecommendationModule {}
