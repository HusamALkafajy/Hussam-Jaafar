import { StructuralBlock } from '@studyai/ast';

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
   */
  public readonly blocks: StructuralBlock[];

  /**
   * Extraction metadata such as warnings or page count.
   */
  public readonly metadata?: Record<string, any>;

  /**
   * Internal constructor. Use ExtractedDocumentFactory to instantiate.
   */
  protected constructor(fullText: string, blocks: StructuralBlock[], metadata?: Record<string, any>) {
    this.fullText = fullText;
    this.blocks = blocks;
    this.metadata = metadata;
  }
}
