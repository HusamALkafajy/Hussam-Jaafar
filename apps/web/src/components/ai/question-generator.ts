'use client';

import { ReadingContext } from '../../mocks/workspace/reading-context';
import { SuggestedQuestion, getSuggestedQuestions } from '../../mocks/workspace/question-generator';

class QuestionGeneratorStrategy {
  getSuggestions(context: ReadingContext): SuggestedQuestion[] {
    // Currently deterministic mock. Will be replaced by AI.
    return getSuggestedQuestions(context);
  }
}

export const questionGenerator = new QuestionGeneratorStrategy();
