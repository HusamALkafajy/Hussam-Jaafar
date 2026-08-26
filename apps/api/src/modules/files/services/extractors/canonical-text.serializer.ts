import { StructuralBlock } from '@studyai/ast';

export class CanonicalTextSerializer {
  /**
   * Deterministically serializes an ordered array of StructuralBlocks into a canonical fullText string.
   * This ensures the RAG representation and the AST representation never diverge.
   * 
   * @param blocks The ordered blocks to serialize.
   * @returns Byte-identical canonical text output for the given blocks.
   */
  static serialize(blocks: StructuralBlock[]): string {
    if (!blocks || blocks.length === 0) return '';
    
    return blocks
      .map(block => this.serializeBlock(block))
      .filter(text => text.length > 0)
      .join('\n\n');
  }

  private static serializeBlock(block: StructuralBlock): string {
    if (!block.text) return '';

    // Normalize whitespace internally, removing accidental multi-spaces or weird newlines.
    // However, since some blocks might intentionally contain newlines (e.g., code),
    // we only trim the outer edges for most blocks.
    const trimmed = block.text.trim();
    if (!trimmed) return '';

    switch (block.type) {
      case 'list_item':
        // Semantic markdown-like representation for lists helps RAG chunking
        return `- ${trimmed}`;
      
      case 'table':
      case 'code':
      case 'quote':
      case 'paragraph':
      case 'document':
      case 'image':
      case 'unknown':
        return trimmed;

      default:
        // Handle heading_1 through heading_6
        if (block.type.startsWith('heading_')) {
          // Returning raw text for headings without markdown `#` because 
          // the visual level is an implementation detail and we just want semantic text
          return trimmed;
        }
        return trimmed;
    }
  }
}
