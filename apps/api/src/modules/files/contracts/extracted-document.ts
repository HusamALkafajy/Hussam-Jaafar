import { StructuralBlock } from '@studyai/ast';

export interface ExtractionMetadata {
  pageCount?: number;
  [key: string]: unknown;
}

/**
 * The canonical extraction contract.
 * Extractors must produce this interface.
 */
export class ExtractedDocument {
  /**
   * The canonical full text representation of the document,
   * used downstream by RAG and summary generation.
   */
  public readonly fullText: string;

  /**
   * The canonical structural representation of the document,
   * used downstream to generate the AST for the Reader.
   *
   * NOTE: Extractors MUST attach page provenance when applicable.
   * By strict convention, if a block originates from a paginated format (e.g. PDF),
   * the extractor MUST attach `metadata.sourcePage`.
   * `sourcePage` is strictly defined as a 1-based human-facing document page number
   * (where the first page of the document is 1). It is NOT a 0-based array index.
   */
  public readonly blocks: StructuralBlock[];

  /**
   * Extraction metadata such as warnings or page count.
   */
  public readonly metadata?: ExtractionMetadata;

  /**
   * Internal constructor. Use ExtractedDocumentFactory to instantiate.
   */
  protected constructor(fullText: string, blocks: StructuralBlock[], metadata?: ExtractionMetadata) {
    this.fullText = fullText;
    this.blocks = blocks;
    this.metadata = metadata;
  }
}
