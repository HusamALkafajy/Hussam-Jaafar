import { LearningAsset } from '../../learning-asset';
import { AnswerPayload } from '../assessment-attempt';

export interface ValidationResult {
  isCorrect: boolean;
  scoreAwarded: number;
  expectedAnswer?: any;
  feedback?: string;
}

export class AnswerValidator {
  static validate(answer: AnswerPayload, asset: LearningAsset): ValidationResult {
    const expected = asset.content?.correctAnswer;
    
    // Simplistic validation for placeholder purposes.
    // In a real system, we'd have different validators per question type.
    const isCorrect = expected !== undefined && JSON.stringify(answer.value) === JSON.stringify(expected);

    return {
      isCorrect,
      scoreAwarded: isCorrect ? 1 : 0,
      expectedAnswer: expected,
      feedback: isCorrect ? 'Correct!' : 'Incorrect.'
    };
  }
}
