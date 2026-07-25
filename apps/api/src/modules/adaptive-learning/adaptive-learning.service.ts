import { Injectable, Logger } from '@nestjs/common';
import { Recommendation, AdaptiveGoal, LearnerProfile, ProgressEvaluation, MasteryEstimate } from '@studyai/domain';
import { LearnerProfileService } from './learner-profile.service';
import { LearningGoalService } from './learning-goal.service';
import { LearningPathPlannerService, PlannedPathNode } from './learning-path-planner.service';
import { ProgressEvaluatorService } from './progress-evaluator.service';
import { MasteryEstimatorService } from './mastery-estimator.service';

export interface AdaptiveState {
  profile: LearnerProfile;
  goals: AdaptiveGoal[];
  plannedPath: PlannedPathNode[];
  progress: ProgressEvaluation;
}

@Injectable()
export class AdaptiveLearningService {
  private readonly logger = new Logger(AdaptiveLearningService.name);

  constructor(
    private readonly profileService: LearnerProfileService,
    private readonly goalService: LearningGoalService,
    private readonly pathPlanner: LearningPathPlannerService,
    private readonly progressEvaluator: ProgressEvaluatorService,
    private readonly masteryEstimator: MasteryEstimatorService,
  ) {}

  /**
   * Retrieves the full adaptive state for a user.
   * This acts as the aggregation boundary.
   */
  async getAdaptiveState(userId: string, rawRecommendations: Recommendation[] = []): Promise<AdaptiveState> {
    this.logger.debug(`Fetching adaptive state for user ${userId}`);

    // 1. Fetch/Build Learner Profile (Cached Read Model)
    const profile = await this.profileService.getProfile(userId);

    // 2. Generate Adaptive Goals dynamically based on the profile
    const goals = this.goalService.generateGoals(profile);

    // 3. Plan deterministic path filtering/ordering recommendations based on goals
    const plannedPath = this.pathPlanner.planPath(profile, goals, rawRecommendations);

    // 4. Evaluate Progress
    const progress = this.progressEvaluator.evaluateProgress(profile);

    return {
      profile,
      goals,
      plannedPath,
      progress,
    };
  }

  /**
   * Explains mastery for a specific concept on-demand.
   */
  async explainConceptMastery(userId: string, conceptId: string): Promise<MasteryEstimate> {
    const profile = await this.profileService.getProfile(userId);
    return this.masteryEstimator.estimateMastery(userId, profile, conceptId);
  }

  /**
   * Explicitly invalidates the cache. Called by domain events.
   */
  async invalidateProfileContext(userId: string, reason: string): Promise<void> {
    await this.profileService.invalidateProfile(userId, reason);
  }
}
