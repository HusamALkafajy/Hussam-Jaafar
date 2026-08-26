import { Recommendation, UserLearningContext } from '@studyai/domain';
import { RecommendationRule } from './rule.interface';
import { randomUUID } from 'crypto';
import { RecommendationExplanationProvider } from '../providers/recommendation-explanation.provider';

export class TutorRemediationRule implements RecommendationRule {
  readonly id = 'rule_tutor_remediation_001';
  readonly description = 'Recommends an AI Tutor session for recently struggled topics or recent sessions.';
  readonly priority = 'Medium';

  constructor(private explanationProvider: RecommendationExplanationProvider) {}

  evaluate(context: UserLearningContext): Recommendation[] {
    if (context.recentTutorSessions.length === 0) {
      return [];
    }

    const lastSession = context.recentTutorSessions[0];
    
    // Suggest continuing or asking more about the recent tutor session topic
    return [
      {
        id: randomUUID(),
        type: 'AskTutor',
        priority: this.priority,
        confidence: 0.80,
        educationalObjective: 'Clarify complex concepts through conversational tutoring.',
        explanation: this.explanationProvider.explainTutorRemediation(lastSession.topic),
        evidence: [
          {
            sourceType: 'tutor_session',
            sourceId: lastSession.id,
            description: `You recently discussed "${lastSession.topic}" with the AI Tutor.`,
          },
        ],
        targetResourceId: lastSession.id,
        targetResourceType: 'tutor_session',
      },
    ];
  }
}
