import { Recommendation, UserLearningContext } from '@studyai/domain';
import { RecommendationRule } from './rule.interface';
import { randomUUID } from 'crypto';
import { RecommendationExplanationProvider } from '../providers/recommendation-explanation.provider';

export class SpacedRepetitionRule implements RecommendationRule {
  readonly id = 'rule_spaced_repetition_001';
  readonly description = 'Recommends reviewing flashcards if any are currently due.';
  readonly priority = 'High';

  constructor(private explanationProvider: RecommendationExplanationProvider) {}

  evaluate(context: UserLearningContext): Recommendation[] {
    if (context.dueFlashcardsCount > 0) {
      return [
        {
          id: randomUUID(),
          type: 'ReviewFlashcards',
          priority: this.priority,
          confidence: 0.95,
          educationalObjective: 'Optimize long-term retention via active recall.',
          explanation: this.explanationProvider.explainSpacedRepetition(context.dueFlashcardsCount),
          evidence: [
            {
              sourceType: 'flashcard_review',
              description: `${context.dueFlashcardsCount} flashcards are due for review based on spaced repetition decay.`,
            },
          ],
        },
      ];
    }

    return [];
  }
}
