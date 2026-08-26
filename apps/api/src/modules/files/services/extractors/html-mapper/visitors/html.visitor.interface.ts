import { HtmlNode } from '../html-node.interface';
import { HtmlAstBuilder } from '../html-ast.builder';

export interface HtmlVisitor {
  visit(node: HtmlNode, builder: HtmlAstBuilder, coordinator: (node: HtmlNode) => void): void;
}
