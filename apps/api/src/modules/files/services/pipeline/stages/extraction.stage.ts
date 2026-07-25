import { Injectable, Logger } from '@nestjs/common';
import { PipelineStage, PipelineContext } from '../pipeline-stage.interface';
import { ExtractorRegistry } from '../../extractor.registry';
import { DocumentExtractionContext } from '../../../contracts/document-extractor';

@Injectable()
export class ExtractionStage implements PipelineStage<any, any> {
  readonly stageName = 'Extraction';
  private readonly logger = new Logger(ExtractionStage.name);

  constructor(private readonly extractorRegistry: ExtractorRegistry) {}

  async canSkip(context: PipelineContext): Promise<boolean> {
    return !!context.state.extractedDocument;
  }

  async execute(input: any, context: PipelineContext): Promise<any> {
    const { fileId, filePath, mimeType, fileType } = input;
    
    const extractionContext: DocumentExtractionContext = {
      fileId,
      filePath,
      mimeType,
      fileType,
      signal: context.signal,
    };

    const extractor = this.extractorRegistry.getExtractor(mimeType);
    const extractedDocument = await extractor.extract(extractionContext);
    
    context.state.extractedDocument = extractedDocument;
    
    return { ...input, extractedDocument };
  }
}
