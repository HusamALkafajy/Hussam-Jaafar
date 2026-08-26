import { LearningContextInterface } from './learning-context-interface';
import { GenerationStrategy } from './strategies/generation-strategy';
import { AssetFactory } from './asset-factory';
import { AssetRegistry } from './asset-registry';
import { LearningAsset, DifficultyLevel } from './learning-asset';

export class LearningEngine {
  private assetRegistry: AssetRegistry;

  constructor(assetRegistry: AssetRegistry) {
    this.assetRegistry = assetRegistry;
  }

  async generateAssets(
    context: LearningContextInterface, 
    strategy: GenerationStrategy,
    difficulty: DifficultyLevel = 'Medium'
  ): Promise<LearningAsset[]> {
    // 1. Strategy generates Artifacts (pure content, no IDs)
    const artifacts = await strategy.generate(context);

    // 2. Factory converts Artifacts to immutable Assets
    const assets = artifacts.map(artifact => 
      AssetFactory.createAssetFromArtifact(artifact, difficulty)
    );

    // 3. Register Assets
    assets.forEach(asset => this.assetRegistry.register(asset));

    // 4. (Optional) Broadcast event
    // EventBus.emit('asset.generated', { assets });

    return assets;
  }
}
