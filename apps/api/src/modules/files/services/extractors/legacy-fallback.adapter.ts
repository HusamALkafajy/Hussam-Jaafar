import { Logger } from '@nestjs/common';
import { DocumentExtractor, DocumentExtractionContext, MissingTextLayerError } from '../../contracts/document-extractor';
import { ExtractedDocument } from '../../contracts/extracted-document';
import { AiService } from '../../../ai/ai.service';
import { TextFallbackExtractor } from './text-fallback.extractor';
import * as mammoth from 'mammoth';

/**
 * An explicit compatibility adapter bridging the new generic extraction 
 * contract with the legacy string-based extraction pipeline.
 * 
 * This ensures that E1 can be deployed independently without regressing
 * current PDF and image capabilities, which still rely on AiService.
 */
export class LegacyFallbackAdapter implements DocumentExtractor {
  private readonly logger = new Logger(LegacyFallbackAdapter.name);

  constructor(private readonly aiService: AiService) {}

  async extract(context: DocumentExtractionContext): Promise<ExtractedDocument> {
    if (!context.filePath) {
      throw new MissingTextLayerError('Legacy extraction requires a local source path.');
    }
    let extractedText = '';
    let targetFilePath = context.filePath;
    let isTempFile = false;
    const type = context.fileType;

    try {
      if (type === 'pdf' || type === 'image') {
        extractedText = await this.aiService.extractText(targetFilePath, context.mimeType);
      } else if (type === 'docx') {
        const result = await mammoth.extractRawText({ path: targetFilePath });
        extractedText = result.value;
      } else {
        throw new Error(`Legacy adapter does not support file type: ${type}`);
      }
    } finally {
      if (isTempFile) {
        // Temp file cleanup for legacy PDF range slicing (omitted here since it's not currently used synchronously,
        // but preserved if it was ever passed in).
      }
    }

    if (!extractedText || extractedText.trim() === '') {
      if (type === 'pdf' || type === 'image') {
        // Fallback to the new formal taxonomy
        throw new MissingTextLayerError('PDF/Image extraction returned no usable text. Failing explicitly to prevent empty publication.');
      }
      this.logger.warn(`Empty extracted text for File ID: ${context.fileId}. Returning empty ExtractedDocument.`);
      extractedText = '';
    }

    // Map the string through the fallback text extractor to generate canonical blocks
    return TextFallbackExtractor.extract(extractedText);
  }
}
