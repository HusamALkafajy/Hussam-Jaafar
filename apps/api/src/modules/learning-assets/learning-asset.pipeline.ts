import { Injectable, Logger } from '@nestjs/common';
import { AssetGenerator } from './contracts/asset-generator';
import { KnowledgeGraph } from '../knowledge/contracts/knowledge-graph';
import { LearningAsset } from './contracts/learning-asset';

@Injectable()
export class LearningAssetPipeline {
  private readonly logger = new Logger(LearningAssetPipeline.name);
  private generators: AssetGenerator[] = [];

  registerGenerators(generators: AssetGenerator[]): void {
    this.generators = generators;
  }

  async generateAssets(graph: KnowledgeGraph, context: any): Promise<LearningAsset[]> {
    const assets: LearningAsset[] = [];

    this.logger.log(`[LearningAssetPipeline] Generating assets from graph version ${graph.metadata.version}`);

    for (const generator of this.generators) {
      this.logger.log(`[LearningAssetPipeline] Running generator for ${generator.assetType}`);
      const generatedAssets: LearningAsset[] = [];
      try {
        const payloads = await Promise.resolve(generator.generatePayloads(graph, context));
        for (const payload of payloads) {
          if (generator.validatePayload(payload)) {
            const asset = generator.mapToAsset(payload, graph);
            generatedAssets.push(asset);
            assets.push(asset);
          }
        }
        
        if (generatedAssets.length > 0) {
          await generator.persist(generatedAssets, context);
        }
      } catch (err: any) {
        this.logger.error(`[LearningAssetPipeline] Generator ${generator.assetType} failed: ${err.message}`);
      }
    }

    this.logger.log(`[LearningAssetPipeline] Generated ${assets.length} total assets.`);
    return assets;
  }
}
