import { ImmutableCitation } from './citation';
import { AssetLifecycleStatus } from './asset-lifecycle';
import { ArtifactType } from './learning-artifact';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Adaptive';

export interface LearningAsset {
  readonly assetId: string;
  readonly assetType: ArtifactType;
  readonly sourceCitation: ImmutableCitation;
  readonly difficulty: DifficultyLevel;
  readonly metadata: Record<string, any>;
  readonly content: any;
  readonly createdAt: string;
  readonly status: AssetLifecycleStatus;
}
