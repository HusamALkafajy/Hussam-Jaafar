import { ExtractedDocument } from './extracted-document';

export interface DocumentExtractionContext {
  fileId: string;
  filePath: string;
  mimeType: string;
  fileType?: string; // Optional discriminator e.g. 'pdf', 'docx'
  signal?: AbortSignal;
}

export interface DocumentExtractor {
  extract(context: DocumentExtractionContext): Promise<ExtractedDocument>;
}

// Extraction Failure Taxonomy
export class UnsupportedDocumentFormatError extends Error {
  readonly isRetryable = false;
  readonly isOcrEligible = false;
  readonly name = 'UnsupportedDocumentFormatError';

  constructor(mimeType: string) {
    super(`Unsupported document format: ${mimeType}`);
  }
}

export class MissingTextLayerError extends Error {
  readonly isRetryable = false;
  readonly isOcrEligible = true;
  readonly name = 'MissingTextLayerError';

  constructor(message = 'Document has no text layer and requires OCR.') {
    super(message);
  }
}

export class ExtractionResourceLimitError extends Error {
  readonly isRetryable = false;
  readonly isOcrEligible = false;
  readonly name = 'ExtractionResourceLimitError';

  constructor(message = 'Document exceeds maximum allowed extraction resources.') {
    super(message);
  }
}

export class MalformedDocumentError extends Error {
  readonly isRetryable = false;
  readonly isOcrEligible = false;
  readonly name = 'MalformedDocumentError';

  constructor(message = 'Document is malformed and cannot be parsed.') {
    super(message);
  }
}

export class EncryptedDocumentError extends Error {
  readonly isRetryable = false;
  readonly isOcrEligible = false;
  readonly name = 'EncryptedDocumentError';

  constructor(message = 'Document is encrypted or password protected.') {
    super(message);
  }
}

export class EmptyDocumentError extends Error {
  readonly isRetryable = false;
  readonly isOcrEligible = false;
  readonly name = 'EmptyDocumentError';

  constructor(message = 'Document contains no extractable text.') {
    super(message);
  }
}
