import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { GamificationService } from '../study-coach/gamification.service';
import { StudyCoachService } from '../study-coach/study-coach.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly studyCoachService: StudyCoachService,
  ) {}

  /** GET /gamification/status — XP, level, and progress to next level */
  @Get('status')
  async getStatus(@CurrentUser('sub') userId: string) {
    const profile = await this.studyCoachService.getStudentProfile(userId);
    const xp = profile.xp;
    const level = profile.currentLevel;

    const currentLevelThreshold = this.gamificationService.getXpThresholdForLevel(level);
    const nextLevelThreshold = this.gamificationService.getXpThresholdForLevel(level + 1);

    const xpInCurrentLevel = xp - currentLevelThreshold;
    const xpNeededForNextLevel = nextLevelThreshold - currentLevelThreshold;

    let progressPercentage = 0;
    if (xpNeededForNextLevel > 0) {
      progressPercentage = Math.min(
        Math.max(Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100), 0),
        100,
      );
    }

    return { level, totalXp: xp, xpInCurrentLevel, xpNeededForNextLevel, progressPercentage };
  }

  /** GET /gamification/badges — all badges with earned status */
  @Get('badges')
  getBadges(@CurrentUser('sub') userId: string) {
    return this.gamificationService.getBadges(userId);
  }

  /**
   * GET /gamification/challenges
   * Returns all currently active challenges with this user's progress.
   * Daily challenges reset each day; weekly challenges reset each week.
   */
  @Get('challenges')
  getChallenges(@CurrentUser('sub') userId: string) {
    return this.gamificationService.getActiveChallenges(userId);
  }

  /**
   * GET /gamification/leaderboard?limit=20
   * Returns the top-N users by XP.
   * Names are privacy-safe: "John D." format (first name + last initial).
   */
  @Get('leaderboard')
  getLeaderboard(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20;
    return this.gamificationService.getLeaderboard(parsedLimit);
  }
}
