export interface HtmlNode {
  readonly tagName: string;
  readonly textContent: string;
  readonly innerHtml: string;
  
  getDirectTextContent(): string;
  getAttribute(name: string): string | undefined;
  getChildren(): HtmlNode[];
}
