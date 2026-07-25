import { SpacedRepetitionRule } from './spaced-repetition.rule';
import { RecommendationExplanationProvider } from '../providers/recommendation-explanation.provider';
import { UserLearningContext } from '@studyai/domain';

describe('SpacedRepetitionRule', () => {
  let rule: SpacedRepetitionRule;
  let provider: RecommendationExplanationProvider;

  beforeEach(() => {
    provider = new RecommendationExplanationProvider();
    rule = new SpacedRepetitionRule(provider);
  });

  it('should return empty array if no flashcards are due', () => {
    const context: UserLearningContext = {
      userId: 'test_user',
      recentQuizzes: [],
      dueFlashcardsCount: 0,
      recentTutorSessions: []
    };

    const results = rule.evaluate(context);
    expect(results).toHaveLength(0);
  });

  it('should return a ReviewFlashcards recommendation if flashcards are due', () => {
    const context: UserLearningContext = {
      userId: 'test_user',
      recentQuizzes: [],
      dueFlashcardsCount: 5,
      recentTutorSessions: []
    };

    const results = rule.evaluate(context);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('ReviewFlashcards');
    expect(results[0].priority).toBe('High');
    expect(results[0].explanation).toContain('5 flashcards due');
    expect(results[0].evidence[0].sourceType).toBe('flashcard_review');
  });
});
