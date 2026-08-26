import { HtmlVisitor } from './html.visitor.interface';
import { HtmlNode } from '../html-node.interface';
import { HtmlAstBuilder } from '../html-ast.builder';

export class TableVisitor implements HtmlVisitor {
  visit(node: HtmlNode, builder: HtmlAstBuilder, _coordinator: (node: HtmlNode) => void): void {
    const matrix: string[][] = [];

    const trs = node.getChildren().filter(c => c.tagName === 'tr' || c.tagName === 'tbody' || c.tagName === 'thead');
    
    // Helper to get all TRs, unwrapping tbody/thead
    const allTrs: HtmlNode[] = [];
    for (const tr of trs) {
      if (tr.tagName === 'tr') {
        allTrs.push(tr);
      } else {
        allTrs.push(...tr.getChildren().filter(c => c.tagName === 'tr'));
      }
    }

    for (const tr of allTrs) {
      const rowData: string[] = [];
      const tds = tr.getChildren().filter(c => c.tagName === 'td' || c.tagName === 'th');
      
      for (const td of tds) {
        // V1: simplified text extraction for table cells.
        // It's possible tables contain nested tables, but Mammoth usually flattens or keeps them simple.
        rowData.push(td.textContent.trim());
      }
      if (rowData.length > 0) {
        matrix.push(rowData);
      }
    }

    if (matrix.length > 0) {
      builder.addTable(matrix);
    }
  }
}
