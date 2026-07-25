import { HtmlVisitor } from './html.visitor.interface';
import { HtmlNode } from '../html-node.interface';
import { HtmlAstBuilder } from '../html-ast.builder';

export class ImageVisitor implements HtmlVisitor {
  visit(node: HtmlNode, builder: HtmlAstBuilder, _coordinator: (node: HtmlNode) => void): void {
    const src = node.getAttribute('src');
    const alt = node.getAttribute('alt');

    if (src) {
      builder.addImage(src, alt);
    }
  }
}
