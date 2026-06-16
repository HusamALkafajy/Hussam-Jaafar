import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { StudyCoachModule } from '../study-coach/study-coach.module';

@Module({
  imports: [StudyCoachModule],
  controllers: [GamificationController],
})
export class GamificationModule {}
