import { StructuralBlock, StructuralBlockType } from '@studyai/ast';

export class HtmlAstBuilder {
  private blocks: StructuralBlock[] = [];
  private listContexts: { type: 'ordered' | 'unordered'; depth: number }[] = [];

  getBlocks(): StructuralBlock[] {
    return this.blocks;
  }

  addHeading(text: string, level: number): void {
    if (!text.trim()) return;
    const type = `heading_${Math.min(Math.max(level, 1), 6)}` as StructuralBlockType;
    this.blocks.push({
      type,
      text: text.trim(),
    });
  }

  addParagraph(text: string, metadata?: Record<string, any>): void {
    if (!text.trim()) return;
    this.blocks.push({
      type: 'paragraph',
      text: text.trim(),
      metadata,
    });
  }

  beginList(type: 'ordered' | 'unordered'): void {
    this.listContexts.push({ type, depth: this.listContexts.length + 1 });
  }

  addListItem(text: string): void {
    if (!text.trim()) return;
    const currentContext = this.listContexts[this.listContexts.length - 1];
    this.blocks.push({
      type: 'list_item',
      text: text.trim(),
      metadata: {
        listType: currentContext?.type || 'unordered',
        listDepth: currentContext?.depth || 1,
      },
    });
  }

  endList(): void {
    this.listContexts.pop();
  }

  addTable(matrix: string[][]): void {
    if (matrix.length === 0) return;
    this.blocks.push({
      type: 'table',
      text: matrix.map(row => row.join(' | ')).join('\n'), // Flatten text representation for standard extraction
      metadata: {
        rows: matrix.length,
        columns: Math.max(...matrix.map(row => row.length)),
        matrix,
      },
    });
  }

  addImage(src: string, alt?: string): void {
    this.blocks.push({
      type: 'image',
      text: alt || 'Image',
      metadata: {
        src,
      },
    });
  }
}
