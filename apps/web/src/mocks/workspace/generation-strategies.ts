import { GenerationStrategy } from '@studyai/domain/strategies/generation-strategy';
import { FlashcardGenerationStrategy } from '@studyai/domain/strategies/flashcard-strategy';
import { QuizGenerationStrategy } from '@studyai/domain/strategies/quiz-strategy';
import { RevisionGenerationStrategy } from '@studyai/domain/strategies/revision-strategy';
import { SummaryGenerationStrategy } from '@studyai/domain/strategies/summary-strategy';

export const MOCK_GENERATION_STRATEGIES: Record<string, GenerationStrategy> = {
  Flashcard: new FlashcardGenerationStrategy(),
  QuizQuestion: new QuizGenerationStrategy(),
  RevisionPlan: new RevisionGenerationStrategy(),
  Summary: new SummaryGenerationStrategy()
};
