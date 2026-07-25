import { HtmlNode } from './html-node.interface';
import { Cheerio, load } from 'cheerio';

export class CheerioHtmlNode implements HtmlNode {
  constructor(private readonly element: Cheerio<any>, private readonly $: ReturnType<typeof load>) {}

  get tagName(): string {
    return (this.element.prop('tagName') || '').toLowerCase();
  }

  get textContent(): string {
    return this.element.text().trim();
  }

  get innerHtml(): string {
    return this.element.html() || '';
  }

  getDirectTextContent(): string {
    // Clone the element, remove any nested lists/tables, and get the text
    const clone = this.element.clone();
    clone.find('ul, ol, table').remove();
    return clone.text().trim();
  }

  getAttribute(name: string): string | undefined {
    return this.element.attr(name);
  }

  getChildren(): HtmlNode[] {
    const childrenNodes: HtmlNode[] = [];
    this.element.children().each((_, child) => {
      childrenNodes.push(new CheerioHtmlNode(this.$(child), this.$));
    });
    return childrenNodes;
  }
}
