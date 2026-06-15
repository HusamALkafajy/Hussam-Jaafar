import { Module } from '@nestjs/common';
import { StudyCoachController } from './study-coach.controller';
import { StudyCoachService } from './study-coach.service';
import { GamificationService } from './gamification.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [StudyCoachController],
  providers: [StudyCoachService, GamificationService],
  exports: [StudyCoachService, GamificationService],
})
export class StudyCoachModule {}
