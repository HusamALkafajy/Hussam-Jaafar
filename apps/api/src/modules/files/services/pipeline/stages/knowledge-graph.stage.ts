import { Injectable, Logger } from '@nestjs/common';
import { PipelineStage, PipelineContext } from '../pipeline-stage.interface';
import { KnowledgeGraphBuilder } from '../../../../knowledge/knowledge-graph.builder';
import { KnowledgeExtractionContext } from '../../../../knowledge/contracts/knowledge-extraction-provider';
import * as crypto from 'crypto';

@Injectable()
export class KnowledgeGraphStage implements PipelineStage<any, any> {
  readonly stageName = 'Knowledge Graph Construction';
  private readonly logger = new Logger(KnowledgeGraphStage.name);

  constructor(private readonly graphBuilder: KnowledgeGraphBuilder) {}

  async canSkip(context: PipelineContext): Promise<boolean> {
    return !!context.state.knowledgeGraph;
  }

  async execute(input: any, context: PipelineContext): Promise<any> {
    const { fileId, chunks } = input;
    
    if (!chunks) {
      throw new Error('KnowledgeGraphStage requires chunks in input');
    }

    const graphVersion = crypto.createHash('md5').update(`v1-${fileId}-${Date.now()}`).digest('hex');

    const extractionContext: KnowledgeExtractionContext = {
      documentId: fileId,
      graphVersion,
    };

    const knowledgeGraph = await this.graphBuilder.build(chunks, extractionContext);
    context.state.knowledgeGraph = knowledgeGraph;

    return { ...input, knowledgeGraph };
  }
}
