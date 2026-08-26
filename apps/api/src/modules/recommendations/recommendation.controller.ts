import { Controller, Post, Get, Param, UseGuards, Body } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationAnalyticsService } from './analytics/recommendation-analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RecommendationAnalyticsEvent } from '@studyai/domain';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly analyticsService: RecommendationAnalyticsService
  ) {}
  @Get()
  async getRecommendations(@CurrentUser('sub') userId: string) {
    return this.recommendationService.getRecommendations(userId);
  }

  @Get('predictive')
  async getPredictiveInsights(@CurrentUser('sub') userId: string) {
    return this.recommendationService.getPredictiveInsights(userId);
  }

  @Post('predictive/:subjectId')
  async generateInsights(
    @CurrentUser('sub') userId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.recommendationService.generatePredictiveInsights(userId, subjectId);
  }

  @Post('events')
  async trackEvent(
    @CurrentUser('sub') userId: string,
    @Body() eventPayload: Omit<RecommendationAnalyticsEvent, 'userId'>,
  ) {
    // Ensure the event is securely attributed to the requesting user
    const event: RecommendationAnalyticsEvent = {
      ...eventPayload,
      userId,
      createdAt: new Date(),
    };
    
    // Fire and forget, failures are handled gracefully inside
    this.analyticsService.publishEvent(event);
    
    return { success: true };
  }
}
