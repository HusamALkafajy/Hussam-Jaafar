import { Injectable, Logger } from '@nestjs/common';
import { MasteryEstimate, LearnerProfile } from '@studyai/domain';

@Injectable()
export class MasteryEstimatorService {
  private readonly logger = new Logger(MasteryEstimatorService.name);

  /**
   * Deterministically estimates mastery based on the LearnerProfile's strong/weak concepts.
   * In the future, this interface will allow swapping in ML models.
   */
  estimateMastery(userId: string, profile: LearnerProfile, conceptId: string): MasteryEstimate {
    this.logger.debug(`Estimating mastery for concept ${conceptId} (User: ${userId})`);

    const strongMatch = profile.strongConcepts.find(c => c.conceptId === conceptId);
    if (strongMatch) {
      return {
        conceptId,
        score: strongMatch.masteryScore,
        confidence: strongMatch.confidence,
        evidence: `Concept identified as a strong area from ${Math.round(strongMatch.confidence * 5)} evaluation(s).`,
        calculationMethod: 'Deterministic',
      };
    }

    const weakMatch = profile.weakConcepts.find(c => c.conceptId === conceptId);
    if (weakMatch) {
      return {
        conceptId,
        score: weakMatch.masteryScore,
        confidence: weakMatch.confidence,
        evidence: `Concept identified as a weak area from ${Math.round(weakMatch.confidence * 5)} evaluation(s).`,
        calculationMethod: 'Deterministic',
      };
    }

    // Fallback conservative estimate if no evidence exists
    return {
      conceptId,
      score: 0.1, // Conservative base score
      confidence: 0,
      evidence: 'No sufficient educational evidence available for this concept.',
      calculationMethod: 'Deterministic',
    };
  }
}
