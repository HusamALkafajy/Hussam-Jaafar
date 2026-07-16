import { LearningAsset } from './learning-asset';
import { Recommendation } from './recommendation';
import { LearningMetrics } from './learning-metrics';

export interface LearningSession {
  readonly id: string;
  readonly documentId: string;
  readonly assets: string[]; // assetIds
  readonly progress: number; // 0.0 to 1.0
  readonly history: string[]; // event IDs
  readonly metrics: LearningMetrics;
  readonly recommendations: Recommendation[];
}
