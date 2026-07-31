// @vitest-environment node

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type Finding = {
  file: string;
  line: number;
  pattern: string;
};

const sourceRoot = path.resolve(__dirname, '../src');
const linkElements = new Set(['Link', 'a']);
const buttonElements = new Set(['Button', 'button']);

function collectTsxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectTsxFiles(fullPath);
    }

    return entry.isFile() && entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
}

function tagName(tag: ts.JsxTagNameExpression) {
  return tag.getText();
}

function childElements(element: ts.JsxElement): ts.JsxElement[] {
  const elements: ts.JsxElement[] = [];

  const visitExpression = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      elements.push(node);
      elements.push(...childElements(node));
      return;
    }

    ts.forEachChild(node, visitExpression);
  };

  for (const child of element.children) {
    if (ts.isJsxElement(child)) {
      elements.push(child);
      elements.push(...childElements(child));
    } else if (ts.isJsxExpression(child) && child.expression) {
      visitExpression(child.expression);
    }
  }

  return elements;
}

function semanticFindings() {
  const actionSidebarLinks: Finding[] = [];
  const nestedInteractive: Finding[] = [];
  const invalidPolymorphicButtons: Finding[] = [];
  let validPolymorphicButtons = 0;

  for (const file of collectTsxFiles(sourceRoot)) {
    const sourceText = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node)) {
        const outerTag = tagName(node.openingElement.tagName);
        const position = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const location = {
          file: path.relative(sourceRoot, file),
          line: position.line + 1,
        };

        for (const child of childElements(node)) {
          const innerTag = tagName(child.openingElement.tagName);
          const isNestedInteractive =
            (linkElements.has(outerTag) && buttonElements.has(innerTag)) ||
            (buttonElements.has(outerTag) && linkElements.has(innerTag));

          if (isNestedInteractive) {
            nestedInteractive.push({
              ...location,
              pattern: `${outerTag}>${innerTag}`,
            });
          }
        }

        if (outerTag === 'Button') {
          const attributes = node.openingElement.attributes.properties;
          const renderAttribute = attributes.find(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(sourceFile) === 'render',
          );

          if (
            renderAttribute &&
            ts.isJsxAttribute(renderAttribute) &&
            renderAttribute.initializer &&
            ts.isJsxExpression(renderAttribute.initializer)
          ) {
            const renderedElement = renderAttribute.initializer.expression;
            const renderedTag =
              renderedElement && ts.isJsxSelfClosingElement(renderedElement)
                ? tagName(renderedElement.tagName)
                : renderedElement && ts.isJsxElement(renderedElement)
                  ? tagName(renderedElement.openingElement.tagName)
                  : null;

            if (renderedTag && linkElements.has(renderedTag)) {
              const hasNonNativeContract = attributes.some(
                (attribute) =>
                  ts.isJsxAttribute(attribute) &&
                  attribute.name.getText(sourceFile) === 'nativeButton' &&
                  attribute.initializer?.getText(sourceFile) === '{false}',
              );

              if (hasNonNativeContract) {
                validPolymorphicButtons += 1;
              } else {
                invalidPolymorphicButtons.push({
                  ...location,
                  pattern: `Button render=${renderedTag}`,
                });
              }
            }
          }
        }

        if (outerTag === 'SidebarNavItem') {
          const attributes = node.openingElement.attributes.properties;
          const hasOnClick = attributes.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(sourceFile) === 'onClick',
          );
          const hasHref = attributes.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(sourceFile) === 'href',
          );

          if (hasOnClick && !hasHref) {
            actionSidebarLinks.push({
              ...location,
              pattern: 'SidebarNavItem action without href',
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return {
    actionSidebarLinks,
    invalidPolymorphicButtons,
    nestedInteractive,
    validPolymorphicButtons,
  };
}

describe('legacy interactive source semantics', () => {
  it('contains no nested link/button controls', () => {
    expect(semanticFindings().nestedInteractive).toEqual([]);
  });

  it('declares every polymorphic navigation Button as non-native', () => {
    const findings = semanticFindings();

    expect(findings.validPolymorphicButtons).toBeGreaterThan(0);
    expect(findings.invalidPolymorphicButtons).toEqual([]);
  });

  it('does not render sidebar actions through anchor navigation items', () => {
    expect(semanticFindings().actionSidebarLinks).toEqual([]);
  });

  it('keeps the core files flow free of native prompts and custom modal overlays', () => {
    const filesPage = fs.readFileSync(
      path.join(sourceRoot, 'app/(dashboard)/files/page.tsx'),
      'utf8',
    );

    expect(filesPage).not.toMatch(/\b(?:window\.)?(?:alert|confirm)\s*\(/);
    expect(filesPage).not.toContain('Upload Modal (HTML portal)');
    expect(filesPage).toContain('<DialogTitle');
    expect(filesPage).toContain('<DialogDescription');
    expect(filesPage).toContain('<AlertDialogTitle');
    expect(filesPage).toContain('<AlertDialogDescription');
  });

  it('centers shared dialog popups consistently in LTR and RTL layouts', () => {
    for (const component of ['dialog.tsx', 'alert-dialog.tsx']) {
      const source = fs.readFileSync(
        path.join(sourceRoot, `components/ui/${component}`),
        'utf8',
      );

      expect(source).toContain('top-1/2 left-1/2');
      expect(source).not.toContain('top-1/2 start-1/2');
    }
  });

  it('uses the shared Select primitive for Private Alpha dashboard selectors', () => {
    for (const component of [
      'app/(dashboard)/files/page.tsx',
      'app/(dashboard)/files/[id]/page.tsx',
      'app/(dashboard)/learning-paths/page.tsx',
    ]) {
      const source = fs.readFileSync(path.join(sourceRoot, component), 'utf8');

      expect(source).not.toContain('<select');
      expect(source).not.toContain('<option');
      expect(source).toContain('<Select');
      expect(source).toContain('aria-labelledby');
    }
  });

  it('keeps shared Select values and popups logical-direction and viewport safe', () => {
    const source = fs.readFileSync(
      path.join(sourceRoot, 'components/ui/select.tsx'),
      'utf8',
    );

    expect(source).toContain('text-start');
    expect(source).toContain('align = "start"');
    expect(source).toContain('max-w-(--available-width)');
    expect(source).not.toContain('text-left');
  });
});
