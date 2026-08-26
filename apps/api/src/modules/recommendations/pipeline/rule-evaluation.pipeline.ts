import { Injectable, Logger } from '@nestjs/common';
import { Recommendation, UserLearningContext } from '@studyai/domain';
import { RecommendationRule } from '../rules/rule.interface';
import { SpacedRepetitionRule } from '../rules/spaced-repetition.rule';
import { LowQuizScoreRule } from '../rules/low-quiz-score.rule';
import { SessionContinuationRule } from '../rules/session-continuation.rule';
import { TutorRemediationRule } from '../rules/tutor-remediation.rule';
import { RecommendationExplanationProvider } from '../providers/recommendation-explanation.provider';

@Injectable()
export class RuleEvaluationPipeline {
  private readonly logger = new Logger(RuleEvaluationPipeline.name);
  private rules: RecommendationRule[];

  constructor(private explanationProvider: RecommendationExplanationProvider) {
    // Initialize rules (Dependency Injection can also be used here for more complex setups)
    this.rules = [
      new SpacedRepetitionRule(this.explanationProvider),
      new LowQuizScoreRule(this.explanationProvider),
      new TutorRemediationRule(this.explanationProvider),
      new SessionContinuationRule(this.explanationProvider),
    ];
  }

  /**
   * Evaluates all configured rules against the user's learning context.
   * Returns a prioritized list of recommendations. Returns empty array if none apply.
   */
  evaluate(context: UserLearningContext): Recommendation[] {
    const allRecommendations: Recommendation[] = [];

    for (const rule of this.rules) {
      try {
        const recommendations = rule.evaluate(context);
        allRecommendations.push(...recommendations);
      } catch (error) {
        this.logger.error(`Rule ${rule.id} failed to evaluate:`, error);
        // Continue evaluating other rules even if one fails
      }
    }

    // Sort by Priority (High > Medium > Low) and then by Confidence
    return allRecommendations.sort((a, b) => {
      const priorityWeight = { High: 3, Medium: 2, Low: 1 };
      const weightA = priorityWeight[a.priority];
      const weightB = priorityWeight[b.priority];

      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return b.confidence - a.confidence;
    });
  }
}
