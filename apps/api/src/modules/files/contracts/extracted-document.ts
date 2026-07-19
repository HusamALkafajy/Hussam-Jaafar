import { StructuralBlock } from '@studyai/ast';

/**
 * The canonical extraction contract.
 * Extractors must produce this interface.
 */
export interface ExtractedDocument {
  /**
   * The canonical full text representation of the document,
   * used downstream by RAG and summary generation.
   */
  fullText: string;

  /**
   * The canonical structural representation of the document,
   * used downstream to generate the AST for the Reader.
   * 
   * These blocks must be flat, ordered, and contain no database IDs.
   * Identity generation remains strictly owned by the ASTBuilder.
   */
  blocks: StructuralBlock[];
}
