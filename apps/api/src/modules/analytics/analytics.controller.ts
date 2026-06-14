import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getOverviewStats(userId);
  }

  @Get('metrics')
  async getMetrics(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getStudentMetrics(userId);
  }

  @Get('progress')
  async getProgress(
    @CurrentUser('sub') userId: string,
    @Query('limitDays') limitDays?: string,
  ) {
    const limit = limitDays ? parseInt(limitDays, 10) : 30;
    return this.analyticsService.getDailyProgress(userId, limit);
  }

  @Get('subjects')
  async getSubjects(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getSubjectMetrics(userId);
  }

  @Get('report/weekly')
  async getWeeklyReport(@CurrentUser('sub') userId: string) {
    return this.analyticsService.generateWeeklyReport(userId);
  }

  @Get('report/monthly')
  async getMonthlyReport(@CurrentUser('sub') userId: string) {
    return this.analyticsService.generateMonthlyReport(userId);
  }
}
