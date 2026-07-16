import { RecommendationStrategy } from './recommendation-strategy';
import { LearningContextInterface } from './learning-context-interface';
import { LearningAsset } from './learning-asset';
import { Recommendation } from './recommendation';

export class RecommendationEngine {
  private strategy: RecommendationStrategy;

  constructor(strategy: RecommendationStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: RecommendationStrategy) {
    this.strategy = strategy;
  }

  async recommend(
    context: LearningContextInterface,
    assets: LearningAsset[],
    interactionHistory: any[]
  ): Promise<Recommendation[]> {
    return this.strategy.recommend(context, assets, interactionHistory);
  }
}
