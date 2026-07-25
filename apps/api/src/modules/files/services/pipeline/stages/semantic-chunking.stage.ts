import { Injectable, Logger } from '@nestjs/common';
import { PipelineStage, PipelineContext } from '../pipeline-stage.interface';
import { SemanticChunkEngine } from '../../../../rag/chunking/semantic-chunk.engine';

@Injectable()
export class SemanticChunkingStage implements PipelineStage<any, any> {
  readonly stageName = 'Semantic Chunking';
  private readonly logger = new Logger(SemanticChunkingStage.name);

  constructor(private readonly chunkEngine: SemanticChunkEngine) {}

  async canSkip(context: PipelineContext): Promise<boolean> {
    return !!context.state.chunks;
  }

  async execute(input: any, context: PipelineContext): Promise<any> {
    const { fileId, extractedDocument } = input;
    
    if (!extractedDocument) {
      throw new Error('SemanticChunkingStage requires extractedDocument in input');
    }

    const chunks = this.chunkEngine.chunkDocument(fileId, extractedDocument);
    context.state.chunks = chunks;

    return { ...input, chunks };
  }
}
