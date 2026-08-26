import { StructuralBlock } from '@studyai/ast';
import { ExtractedDocument } from '../../contracts/extracted-document';
import { EmptyDocumentError } from '../../contracts/document-extractor';
import { ExtractedDocumentFactory } from './extracted-document.factory';

export class TextFallbackExtractor {
  /**
   * Converts unstructured plain text into a deterministically ordered array of StructuralBlocks.
   * Invariants:
   * - normalizes CRLF and bare CR to LF deterministically.
   * - preserves canonical fullText without semantic rewriting.
   * - splits meaningful paragraph boundaries by double newlines (\n\n) to preserve hard-wrapped prose.
   * - ignores blocks containing only whitespace.
   * - emits paragraph StructuralBlocks.
   * - preserves source order.
   * - never infers headings from line length.
   * - never invents list semantics.
   * - never invents hierarchy.
   * - never generates IDs.
   * 
   * @param rawText The raw unstructured text input.
   * @returns An ExtractedDocument containing the fullText and StructuralBlocks.
   */
  static extract(rawText: string): ExtractedDocument {
    // Empty document semantics: explicitly fail extraction.
    // Synthetic minimal blocks must not be fabricated to bypass AST validation.
    if (!rawText) {
      throw new EmptyDocumentError('Text input is null or undefined.');
    }

    // Normalize CRLF and bare CR to LF
    const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // If it's only whitespace, we fail extraction.
    if (normalizedText.trim().length === 0) {
      throw new EmptyDocumentError('Text input contains only whitespace.');
    }

    // Split by double newline to identify paragraph boundaries.
    // This choice preserves prose that is hard-wrapped with single newlines,
    // which is common in plain-text documents.
    const chunks = normalizedText.split(/\n\s*\n/);
    
    const blocks: StructuralBlock[] = [];
    
    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (trimmed.length > 0) {
        blocks.push({
          type: 'paragraph',
          text: trimmed,
          metadata: {}
        });
      }
    }

    return ExtractedDocumentFactory.fromBlocks(blocks);
  }
}
