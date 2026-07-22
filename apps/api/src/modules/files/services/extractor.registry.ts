import { Injectable, Logger } from '@nestjs/common';
import { DocumentExtractor, UnsupportedDocumentFormatError } from '../contracts/document-extractor';

@Injectable()
export class ExtractorRegistry {
  private readonly extractors = new Map<string, DocumentExtractor>();
  private readonly logger = new Logger(ExtractorRegistry.name);

  /**
   * Registers an extractor for a specific MIME type.
   * Duplicate registrations are explicitly rejected to prevent ambiguity.
   * 
   * @param mimeType The exact MIME type to register (e.g., 'application/pdf').
   * @param extractor The extractor instance.
   */
  register(mimeType: string, extractor: DocumentExtractor): void {
    if (this.extractors.has(mimeType)) {
      throw new Error(`Duplicate extraction registration for MIME type: ${mimeType}`);
    }
    this.extractors.set(mimeType, extractor);
    this.logger.debug(`Registered extractor for ${mimeType}`);
  }

  /**
   * Resolves the appropriate extractor for the given MIME type.
   * Explicitly fails for unsupported types.
   * 
   * @param mimeType The MIME type of the document.
   * @returns The resolved DocumentExtractor.
   * @throws UnsupportedDocumentFormatError if no extractor is registered.
   */
  getExtractor(mimeType: string): DocumentExtractor {
    const extractor = this.extractors.get(mimeType);
    if (!extractor) {
      throw new UnsupportedDocumentFormatError(mimeType);
    }
    return extractor;
  }
}
