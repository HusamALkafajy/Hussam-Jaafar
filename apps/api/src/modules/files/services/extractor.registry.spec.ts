import { ExtractorRegistry } from './extractor.registry';
import { DocumentExtractor, DocumentExtractionContext, UnsupportedDocumentFormatError } from '../contracts/document-extractor';
import { ExtractedDocument } from '../contracts/extracted-document';

import { ExtractedDocumentFactory } from './extractors/extracted-document.factory';

class DummyExtractor implements DocumentExtractor {
  async extract(context: DocumentExtractionContext): Promise<ExtractedDocument> {
    return ExtractedDocumentFactory.fromBlocks([]);
  }
}

describe('ExtractorRegistry', () => {
  let registry: ExtractorRegistry;
  let dummyExtractor: DummyExtractor;

  beforeEach(() => {
    registry = new ExtractorRegistry();
    dummyExtractor = new DummyExtractor();
  });

  it('should register and resolve an extractor', () => {
    registry.register('application/pdf', dummyExtractor);
    const resolved = registry.getExtractor('application/pdf');
    expect(resolved).toBe(dummyExtractor);
  });

  it('should explicitly fail for unsupported types', () => {
    expect(() => registry.getExtractor('image/jpeg')).toThrow(UnsupportedDocumentFormatError);
  });

  it('should explicitly fail on duplicate registrations', () => {
    registry.register('text/plain', dummyExtractor);
    expect(() => registry.register('text/plain', dummyExtractor)).toThrow('Duplicate extraction registration for MIME type: text/plain');
  });

  it('should not throw if looking up unknown type without calling register', () => {
    // getExtractor throws explicitly, but doesn't crash the registry state
    expect(() => registry.getExtractor('unknown/type')).toThrow(UnsupportedDocumentFormatError);
  });
});
