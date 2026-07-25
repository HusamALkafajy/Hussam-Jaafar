import { HtmlVisitor } from './html.visitor.interface';
import { HtmlNode } from '../html-node.interface';
import { HtmlAstBuilder } from '../html-ast.builder';

export class HeadingVisitor implements HtmlVisitor {
  visit(node: HtmlNode, builder: HtmlAstBuilder, _coordinator: (node: HtmlNode) => void): void {
    const match = node.tagName.match(/^h([1-6])$/i);
    const level = match ? parseInt(match[1], 10) : 1;
    
    // Links inside headings should be preserved as text
    const text = node.textContent;
    if (text) {
      builder.addHeading(text, level);
    }
  }
}
