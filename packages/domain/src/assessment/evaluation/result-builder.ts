import { AssessmentSession } from '../assessment-session';
import { LearningAsset } from '../../learning-asset';
import { EvaluationEngine } from './evaluation-engine';
import { FeedbackBuilder } from './feedback-builder';
import { AssessmentResult } from './assessment-result';
import { StudyPlan } from '../../adaptive/study-plan';

export class ResultBuilder {
  static buildResult(session: AssessmentSession, assets: LearningAsset[], studyPlan?: StudyPlan): AssessmentResult {
    const answers = session.attempt.answers;
    const evaluations = EvaluationEngine.evaluateAnswers(answers, assets);
    
    let totalScore = 0;
    let correctCount = 0;

    for (const evalResult of evaluations) {
      totalScore += evalResult.validation.scoreAwarded;
      if (evalResult.validation.isCorrect) correctCount++;
    }

    const accuracy = answers.length > 0 ? correctCount / answers.length : 0;
    const completionRate = session.questionIds.length > 0 ? answers.length / session.questionIds.length : 0;
    
    const feedback = FeedbackBuilder.buildFeedback(totalScore, accuracy, assets, studyPlan);

    return {
      attemptId: session.attempt.attemptId,
      score: totalScore,
      accuracy,
      completionRate,
      feedback,
      generatedAt: new Date().toISOString()
    };
  }
}
