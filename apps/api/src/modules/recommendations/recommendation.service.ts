import { Injectable, Logger } from '@nestjs/common';
import { RecommendationContextBuilderProvider } from './providers/recommendation-context-builder.provider';
import { RuleEvaluationPipeline } from './pipeline/rule-evaluation.pipeline';
import { RecommendationRepository } from './recommendation.repository';
import { Recommendation } from '@studyai/domain';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly contextBuilder: RecommendationContextBuilderProvider,
    private readonly rulePipeline: RuleEvaluationPipeline,
    private readonly repository: RecommendationRepository,
  ) {}

  /**
   * Generates and persists recommendations for the user based on the rule engine.
   * This endpoint replaces the legacy ML-based predictive insights generation.
   */
  async generateRecommendations(userId: string): Promise<Recommendation[]> {
    this.logger.log(`Generating rule-based recommendations for user ${userId}`);
    
    // 1. Build the context gracefully handling missing data
    const context = await this.contextBuilder.buildContext(userId);

    // 2. Evaluate all deterministic rules
    const recommendations = this.rulePipeline.evaluate(context);

    // 3. Persist mapped recommendations to database
    // Failure to save will not block returning the recommendations to the user
    try {
      if (recommendations.length > 0) {
        await this.repository.saveRecommendations(userId, recommendations);
      }
    } catch (e) {
      this.logger.error('Failed to persist recommendations, but returning generated list', e);
    }

    return recommendations;
  }

  /**
   * Retrieves pending recommendations for the user.
   * If none exist in the DB, it generates them dynamically.
   */
  async getRecommendations(userId: string) {
    const pending = await this.repository.getPendingRecommendations(userId);
    
    if (pending.length > 0) {
      return pending;
    }

    // Fallback: Generate dynamically if none found
    const newRecommendations = await this.generateRecommendations(userId);
    
    // Convert abstract Recommendations to match the API response contract format
    return newRecommendations.map(rec => ({
      id: rec.id,
      userId,
      subjectId: null,
      type: this.mapAbstractToDbString(rec.type),
      title: rec.type,
      description: rec.explanation,
      isApplied: false,
      scoreImportance: rec.priority === 'High' ? 3 : rec.priority === 'Medium' ? 2 : 1,
      createdAt: new Date(),
    }));
  }

  // Backwards compatibility for the legacy UI expecting predictive insights shape
  async getPredictiveInsights(userId: string) {
    // Return empty set as Predictive Insights (ML) is disabled in MVP
    return [];
  }

  async generatePredictiveInsights(userId: string, subjectId: string) {
     // Return empty as ML generation is disabled, but trigger a recommendation refresh instead
     await this.generateRecommendations(userId);
     return null;
  }

  private mapAbstractToDbString(type: string): string {
    switch (type) {
      case 'RetryQuiz': return 'quiz';
      case 'ReviewFlashcards': 
      case 'RecentlyInterrupted': 
      case 'ContinueSession': return 'study_habit';
      case 'AskTutor': 
      case 'ContinueLearning': return 'lesson';
      case 'ReviewWeakConcepts': return 'review_document';
      default: return 'study_habit';
    }
  }
}
