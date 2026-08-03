import { StructuralBlock } from '@studyai/ast';
import { ExtractedDocument, ExtractionMetadata } from '../../contracts/extracted-document';
import { CanonicalTextSerializer } from './canonical-text.serializer';

class ExtractedDocumentImpl extends ExtractedDocument {
  constructor(fullText: string, blocks: StructuralBlock[], metadata?: ExtractionMetadata) {
    super(fullText, blocks, metadata);
  }
}

export class ExtractedDocumentFactory {
  /**
   * Constructs an ExtractedDocument from an authoritative array of StructuralBlocks.
   * This factory enforces the invariant that fullText is exclusively derived 
   * from the blocks via the CanonicalTextSerializer, preventing divergence.
   * 
   * @param blocks The authoritative structural blocks.
   * @param metadata Optional extraction metadata (e.g. page counts, warnings).
   * @returns An ExtractedDocument where fullText perfectly matches the blocks.
   */
  static fromBlocks(blocks: StructuralBlock[], metadata?: ExtractionMetadata): ExtractedDocument {
    // Enforce single root policy for AST Builder: prepend a single 'document' block if necessary
    let canonicalBlocks = blocks;
    if (blocks.length === 0 || blocks[0].type !== 'document') {
      canonicalBlocks = [
        {
          type: 'document',
          text: '',
          metadata: {
            generatedRoot: true,
            ...(metadata?.pageCount === undefined ? {} : { pageCount: metadata.pageCount }),
          }
        },
        ...blocks
      ];
    }

    return new ExtractedDocumentImpl(
      CanonicalTextSerializer.serialize(canonicalBlocks),
      canonicalBlocks,
      metadata
    );
  }
}
