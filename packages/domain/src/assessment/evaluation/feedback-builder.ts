import { AssessmentResult, AssessmentFeedback } from './assessment-result';
import { LearningAsset } from '../../learning-asset';
import { StudyPlan } from '../../adaptive/study-plan';

export class FeedbackBuilder {
  static buildFeedback(score: number, accuracy: number, assets: LearningAsset[], studyPlan?: StudyPlan): AssessmentFeedback {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (accuracy >= 0.8) {
      strengths.push('Excellent comprehension of the material.');
    } else if (accuracy >= 0.5) {
      strengths.push('Good foundational understanding.');
      weaknesses.push('Needs review on complex topics.');
    } else {
      weaknesses.push('Significant knowledge gaps detected.');
    }

    return {
      strengths,
      weaknesses,
      recommendedReviewIds: assets.slice(0, 2).map(a => a.assetId), // Mock implementation
      suggestedNextActivity: accuracy >= 0.8 ? 'Advance to next topic' : 'Review missed questions'
    };
  }
}
