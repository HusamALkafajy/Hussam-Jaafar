import { ExtractedDocumentFactory } from './extracted-document.factory';

describe('ExtractedDocumentFactory page metadata', () => {
  it('places a verified PDF page count on the canonical version root', () => {
    const document = ExtractedDocumentFactory.fromBlocks(
      [
        { type: 'paragraph', text: 'Page one', metadata: { sourcePage: 1 } },
        { type: 'paragraph', text: 'Page two', metadata: { sourcePage: 2 } },
      ],
      { pageCount: 2 },
    );

    expect(document.metadata).toEqual({ pageCount: 2 });
    expect(document.blocks[0]).toMatchObject({
      type: 'document',
      text: '',
      metadata: { generatedRoot: true, pageCount: 2 },
    });
    expect(document.blocks[1].metadata?.sourcePage).toBe(1);
    expect(document.blocks[2].metadata?.sourcePage).toBe(2);
  });

  it('does not fabricate page metadata for non-paginated extraction', () => {
    const document = ExtractedDocumentFactory.fromBlocks([
      { type: 'paragraph', text: 'Plain text without a source page' },
    ]);

    expect(document.metadata).toBeUndefined();
    expect(document.blocks[0].metadata).toEqual({ generatedRoot: true });
    expect(document.blocks[1].metadata?.sourcePage).toBeUndefined();
  });
});
