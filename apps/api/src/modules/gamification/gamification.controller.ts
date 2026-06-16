import { Controller, Get, UseGuards } from '@nestjs/common';
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

  @Get('status')
  async getStatus(@CurrentUser('sub') userId: string) {
    const profile = await this.studyCoachService.getStudentProfile(userId);
    const xp = profile.xp;
    const level = profile.currentLevel;

    // Calculate dynamic thresholds
    const currentLevelThreshold = this.gamificationService.getXpThresholdForLevel(level);
    const nextLevelThreshold = this.gamificationService.getXpThresholdForLevel(level + 1);
    
    const xpInCurrentLevel = xp - currentLevelThreshold;
    const xpNeededForNextLevel = nextLevelThreshold - currentLevelThreshold;
    
    // Safety check for progress percentage
    let progressPercentage = 0;
    if (xpNeededForNextLevel > 0) {
      progressPercentage = Math.min(
        Math.max(Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100), 0),
        100
      );
    }

    return {
      level,
      totalXp: xp,
      xpInCurrentLevel,
      xpNeededForNextLevel,
      progressPercentage,
    };
  }

  @Get('badges')
  async getBadges(@CurrentUser('sub') userId: string) {
    return this.gamificationService.getBadges(userId);
  }
}
