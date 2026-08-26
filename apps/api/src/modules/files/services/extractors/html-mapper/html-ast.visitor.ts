import { HtmlNode } from './html-node.interface';
import { HtmlAstBuilder } from './html-ast.builder';
import { HtmlVisitor } from './visitors/html.visitor.interface';
import { HeadingVisitor } from './visitors/heading.visitor';
import { ParagraphVisitor } from './visitors/paragraph.visitor';
import { ListVisitor } from './visitors/list.visitor';
import { TableVisitor } from './visitors/table.visitor';
import { ImageVisitor } from './visitors/image.visitor';

export class HtmlAstVisitor {
  private visitors: Map<string, HtmlVisitor> = new Map();
  private builder: HtmlAstBuilder;

  constructor(builder: HtmlAstBuilder) {
    this.builder = builder;
    
    // Register Visitors
    const headingVisitor = new HeadingVisitor();
    this.visitors.set('h1', headingVisitor);
    this.visitors.set('h2', headingVisitor);
    this.visitors.set('h3', headingVisitor);
    this.visitors.set('h4', headingVisitor);
    this.visitors.set('h5', headingVisitor);
    this.visitors.set('h6', headingVisitor);

    const paragraphVisitor = new ParagraphVisitor();
    this.visitors.set('p', paragraphVisitor);

    const listVisitor = new ListVisitor();
    this.visitors.set('ul', listVisitor);
    this.visitors.set('ol', listVisitor);

    const tableVisitor = new TableVisitor();
    this.visitors.set('table', tableVisitor);

    const imageVisitor = new ImageVisitor();
    this.visitors.set('img', imageVisitor);
  }

  public visit(node: HtmlNode): void {
    const tagName = node.tagName;
    
    if (!tagName) {
      // It's likely a text node or document root
      for (const child of node.getChildren()) {
        this.visit(child);
      }
      return;
    }

    const visitor = this.visitors.get(tagName);

    if (visitor) {
      visitor.visit(node, this.builder, this.visit.bind(this));
    } else {
      // Unsupported tag (e.g., div, span wrapper). Traverse children.
      for (const child of node.getChildren()) {
        this.visit(child);
      }
    }
  }
}
