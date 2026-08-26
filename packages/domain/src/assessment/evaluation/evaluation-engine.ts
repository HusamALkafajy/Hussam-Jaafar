import { LearningAsset } from '../../learning-asset';
import { AnswerPayload } from '../assessment-attempt';
import { AnswerValidator, ValidationResult } from './answer-validator';

export interface EvaluationPayload {
  questionId: string;
  answer: AnswerPayload;
  validation: ValidationResult;
}

export class EvaluationEngine {
  static evaluateAnswers(answers: AnswerPayload[], assets: LearningAsset[]): EvaluationPayload[] {
    const results: EvaluationPayload[] = [];
    const assetMap = new Map(assets.map(a => [a.assetId, a]));

    for (const answer of answers) {
      const asset = assetMap.get(answer.questionId);
      if (asset) {
        const validation = AnswerValidator.validate(answer, asset);
        results.push({
          questionId: answer.questionId,
          answer,
          validation
        });
      }
    }

    return results;
  }
}
