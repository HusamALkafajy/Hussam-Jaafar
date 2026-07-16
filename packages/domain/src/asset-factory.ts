import { LearningArtifact } from './learning-artifact';
import { LearningAsset, DifficultyLevel } from './learning-asset';

export class AssetFactory {
  static createAssetFromArtifact(artifact: LearningArtifact, difficulty: DifficultyLevel = 'Medium'): LearningAsset {
    return {
      assetId: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      assetType: artifact.artifactType,
      sourceCitation: artifact.sourceCitation,
      difficulty,
      metadata: artifact.metadata,
      content: artifact.content,
      createdAt: new Date().toISOString(),
      status: 'Generated' // Based on AssetLifecycle
    };
  }
}
