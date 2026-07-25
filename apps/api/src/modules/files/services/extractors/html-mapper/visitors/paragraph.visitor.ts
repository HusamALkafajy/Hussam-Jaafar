import { HtmlVisitor } from './html.visitor.interface';
import { HtmlNode } from '../html-node.interface';
import { HtmlAstBuilder } from '../html-ast.builder';

export class ParagraphVisitor implements HtmlVisitor {
  visit(node: HtmlNode, builder: HtmlAstBuilder, coordinator: (node: HtmlNode) => void): void {
    // Check if the paragraph only contains images
    const children = node.getChildren();
    const hasImages = children.some(c => c.tagName === 'img');
    const hasText = !!node.textContent.trim();

    if (hasImages && !hasText) {
      // If it's just an image wrapper, let the coordinator handle the images directly
      children.forEach(c => coordinator(c));
      return;
    }

    const text = node.textContent;
    if (text) {
      // In a more advanced implementation, we would parse inline `<a>` to extract hyperlinks
      // For V1, we extract raw text.
      builder.addParagraph(text);
    }
  }
}
