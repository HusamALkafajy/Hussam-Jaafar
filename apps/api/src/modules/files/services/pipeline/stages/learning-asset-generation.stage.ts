import { Injectable, Logger } from '@nestjs/common';
import { PipelineStage, PipelineContext } from '../pipeline-stage.interface';
import { LearningAssetPipeline } from '../../../../learning-assets/learning-asset.pipeline';

@Injectable()
export class LearningAssetGenerationStage implements PipelineStage<any, any> {
  readonly stageName = 'Learning Asset Generation';
  private readonly logger = new Logger(LearningAssetGenerationStage.name);

  constructor(private readonly assetPipeline: LearningAssetPipeline) {}

  async canSkip(context: PipelineContext): Promise<boolean> {
    return !!context.state.learningAssets;
  }

  async execute(input: any, context: PipelineContext): Promise<any> {
    const { knowledgeGraph } = input;
    
    if (!knowledgeGraph) {
      throw new Error('LearningAssetGenerationStage requires knowledgeGraph in input');
    }

    const learningAssets = await this.assetPipeline.generateAssets(knowledgeGraph, context);
    context.state.learningAssets = learningAssets;

    return { ...input, learningAssets };
  }
}
