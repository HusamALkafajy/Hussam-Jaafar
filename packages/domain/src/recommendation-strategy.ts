import { LearningContextInterface } from './learning-context-interface';
import { LearningAsset } from './learning-asset';
import { Recommendation } from './recommendation';

export interface RecommendationStrategy {
  recommend(
    context: LearningContextInterface,
    assets: LearningAsset[],
    interactionHistory: any[] // TBD
  ): Promise<Recommendation[]>;
}
