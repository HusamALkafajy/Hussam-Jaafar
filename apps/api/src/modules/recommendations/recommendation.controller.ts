import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

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
}
