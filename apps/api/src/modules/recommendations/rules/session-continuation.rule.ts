import { Recommendation, UserLearningContext } from '@studyai/domain';
import { RecommendationRule } from './rule.interface';
import { randomUUID } from 'crypto';
import { RecommendationExplanationProvider } from '../providers/recommendation-explanation.provider';

export class SessionContinuationRule implements RecommendationRule {
  readonly id = 'rule_session_continuation_001';
  readonly description = 'Recommends continuing the most recently accessed resource.';
  readonly priority = 'Medium';

  constructor(private explanationProvider: RecommendationExplanationProvider) {}

  evaluate(context: UserLearningContext): Recommendation[] {
    if (!context.lastAccessedResource) {
      return [];
    }

    // Only recommend if it was accessed recently (e.g., within the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (context.lastAccessedResource.accessedAt < sevenDaysAgo) {
      return [];
    }

    return [
      {
        id: randomUUID(),
        type: 'ContinueSession',
        priority: this.priority,
        confidence: 0.75,
        educationalObjective: 'Maintain learning momentum by resuming recent activities.',
        explanation: this.explanationProvider.explainSessionContinuation(context.lastAccessedResource.title),
        evidence: [
          {
            sourceType: 'study_history',
            sourceId: context.lastAccessedResource.id,
            description: `You were recently studying "${context.lastAccessedResource.title}".`,
          },
        ],
        targetResourceId: context.lastAccessedResource.id,
        targetResourceType: context.lastAccessedResource.type,
      },
    ];
  }
}
