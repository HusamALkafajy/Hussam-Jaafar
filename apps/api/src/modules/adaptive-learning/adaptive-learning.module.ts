import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { LearnerProfileRepository } from './learner-profile.repository';
import { LearnerProfileService } from './learner-profile.service';
import { MasteryEstimatorService } from './mastery-estimator.service';
import { LearningGoalService } from './learning-goal.service';
import { LearningPathPlannerService } from './learning-path-planner.service';
import { ProgressEvaluatorService } from './progress-evaluator.service';
import { AdaptiveLearningService } from './adaptive-learning.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 3600,
      max: 100, // Maximum number of items in cache
    }),
  ],
  providers: [
    LearnerProfileRepository,
    LearnerProfileService,
    MasteryEstimatorService,
    LearningGoalService,
    LearningPathPlannerService,
    ProgressEvaluatorService,
    AdaptiveLearningService,
  ],
  exports: [AdaptiveLearningService, LearnerProfileService],
})
export class AdaptiveLearningModule {}
