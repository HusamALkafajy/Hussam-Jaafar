import { Module } from '@nestjs/common';
import { LearningPathsController } from './learning-paths.controller';
import { LearningPathsService } from './learning-paths.service';
import { AiModule } from '../ai/ai.module';
import { StudyCoachModule } from '../study-coach/study-coach.module';

@Module({
  imports: [AiModule, StudyCoachModule],
  controllers: [LearningPathsController],
  providers: [LearningPathsService],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
