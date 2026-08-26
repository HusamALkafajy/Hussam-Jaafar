import { HtmlVisitor } from './html.visitor.interface';
import { HtmlNode } from '../html-node.interface';
import { HtmlAstBuilder } from '../html-ast.builder';

export class ListVisitor implements HtmlVisitor {
  visit(node: HtmlNode, builder: HtmlAstBuilder, coordinator: (node: HtmlNode) => void): void {
    const listType = node.tagName === 'ol' ? 'ordered' : 'unordered';
    builder.beginList(listType);

    const children = node.getChildren();
    for (const child of children) {
      if (child.tagName === 'li') {
        // A list item might contain text, or a nested list!
        // We will extract text for this list item, and then let coordinator handle nested lists.
        const itemChildren = child.getChildren();
        const nestedLists = itemChildren.filter(c => c.tagName === 'ul' || c.tagName === 'ol');
        
        // Use the new helper to avoid duplicating nested list text
        const itemText = child.getDirectTextContent();

        if (itemText) {
          builder.addListItem(itemText);
        }

        // Now process nested lists
        for (const nestedList of nestedLists) {
          coordinator(nestedList);
        }
      }
    }

    builder.endList();
  }
}
