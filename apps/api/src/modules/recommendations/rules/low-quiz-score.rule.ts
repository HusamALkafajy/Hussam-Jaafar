import { Recommendation, UserLearningContext } from '@studyai/domain';
import { RecommendationRule } from './rule.interface';
import { randomUUID } from 'crypto';
import { RecommendationExplanationProvider } from '../providers/recommendation-explanation.provider';

export class LowQuizScoreRule implements RecommendationRule {
  readonly id = 'rule_low_quiz_score_001';
  readonly description = 'Recommends retrying the last quiz if the score was below 70%.';
  readonly priority = 'High';

  constructor(private explanationProvider: RecommendationExplanationProvider) {}

  evaluate(context: UserLearningContext): Recommendation[] {
    if (context.recentQuizzes.length === 0) {
      return [];
    }

    // Check most recent quiz
    const lastQuiz = context.recentQuizzes[0];
    
    if (lastQuiz.score < 70) {
      return [
        {
          id: randomUUID(),
          type: 'RetryQuiz',
          priority: this.priority,
          confidence: 0.85,
          educationalObjective: 'Identify and remediate weak concepts from recent assessment.',
          explanation: this.explanationProvider.explainLowQuizScore(lastQuiz.score),
          evidence: [
            {
              sourceType: 'quiz_result',
              sourceId: lastQuiz.id,
              description: `Last quiz score was ${lastQuiz.score}%, which is below the mastery threshold of 70%.`,
            },
          ],
          targetResourceId: lastQuiz.id,
          targetResourceType: 'quiz',
        },
      ];
    }

    return [];
  }
}
