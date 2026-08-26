import { TextFallbackExtractor } from './text-fallback.extractor';
import { EmptyDocumentError } from '../../contracts/document-extractor';

describe('TextFallbackExtractor', () => {
  it('1. should handle an empty string', () => {
    expect(() => TextFallbackExtractor.extract('')).toThrow(EmptyDocumentError);
  });

  it('2. should handle whitespace-only input', () => {
    expect(() => TextFallbackExtractor.extract('   \n  \t  ')).toThrow(EmptyDocumentError);
  });

  it('3. should handle one paragraph', () => {
    const result = TextFallbackExtractor.extract('This is a single paragraph.');
    expect(result.fullText).toBe('This is a single paragraph.');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'This is a single paragraph.', metadata: {} }
    ]);
  });

  it('4. should handle multiple paragraphs separated by one blank line', () => {
    const result = TextFallbackExtractor.extract('Paragraph 1.\n\nParagraph 2.');
    expect(result.fullText).toBe('Paragraph 1.\n\nParagraph 2.');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'Paragraph 1.', metadata: {} },
      { type: 'paragraph', text: 'Paragraph 2.', metadata: {} }
    ]);
  });

  it('5. should handle multiple consecutive blank lines', () => {
    const result = TextFallbackExtractor.extract('Para 1.\n\n\n\nPara 2.');
    expect(result.fullText).toBe('Para 1.\n\nPara 2.');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'Para 1.', metadata: {} },
      { type: 'paragraph', text: 'Para 2.', metadata: {} }
    ]);
  });

  it('6. should normalize CRLF and bare CR to LF', () => {
    const result = TextFallbackExtractor.extract('Line 1\r\n\r\nLine 2\rLine 3\r\nLine 4\nLine 5');
    expect(result.fullText).toBe('Line 1\n\nLine 2\nLine 3\nLine 4\nLine 5');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'Line 1', metadata: {} },
      { type: 'paragraph', text: 'Line 2\nLine 3\nLine 4\nLine 5', metadata: {} }
    ]);
  });

  it('7. should handle a multiline paragraph (single newline preserves paragraph)', () => {
    const result = TextFallbackExtractor.extract('Line 1 of para\nLine 2 of para');
    expect(result.fullText).toBe('Line 1 of para\nLine 2 of para');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'Line 1 of para\nLine 2 of para', metadata: {} }
    ]);
  });

  it('8. should handle leading and trailing whitespace', () => {
    const result = TextFallbackExtractor.extract('   \n\n  Text  \n\n  ');
    expect(result.fullText).toBe('Text');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'Text', metadata: {} }
    ]);
  });

  it('9. should handle Unicode text', () => {
    const result = TextFallbackExtractor.extract('Hello 👋\n\nWorld 🌍');
    expect(result.fullText).toBe('Hello 👋\n\nWorld 🌍');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'Hello 👋', metadata: {} },
      { type: 'paragraph', text: 'World 🌍', metadata: {} }
    ]);
  });

  it('10. should handle Arabic text', () => {
    const result = TextFallbackExtractor.extract('مرحبا بالعالم\n\nهذه فقرة جديدة.');
    expect(result.fullText).toBe('مرحبا بالعالم\n\nهذه فقرة جديدة.');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'مرحبا بالعالم', metadata: {} },
      { type: 'paragraph', text: 'هذه فقرة جديدة.', metadata: {} }
    ]);
  });

  it('11. should produce repeated deterministic execution output', () => {
    const input = 'Deterministic\n\nTest';
    const result1 = TextFallbackExtractor.extract(input);
    const result2 = TextFallbackExtractor.extract(input);
    expect(result1).toEqual(result2);
    // Ensure no random IDs or timestamps are present
    expect(result1.blocks[1]).toStrictEqual({ type: 'paragraph', text: 'Deterministic', metadata: {} });
  });

  it('12. should treat text that resembles a heading as a paragraph', () => {
    const result = TextFallbackExtractor.extract('# This looks like a heading');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: '# This looks like a heading', metadata: {} }
    ]);
  });

  it('13. should treat text that resembles a list as a paragraph', () => {
    const result = TextFallbackExtractor.extract('- Item 1\n- Item 2\n\n1. Numbered 1\n2. Numbered 2');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: '- Item 1\n- Item 2', metadata: {} },
      { type: 'paragraph', text: '1. Numbered 1\n2. Numbered 2', metadata: {} }
    ]);
  });

  it('14. should handle tabs and spaces on blank separator lines', () => {
    const result = TextFallbackExtractor.extract('Para 1\n  \t  \nPara 2');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'Para 1', metadata: {} },
      { type: 'paragraph', text: 'Para 2', metadata: {} }
    ]);
  });

  it('15. should handle emoji and mixed text', () => {
    const result = TextFallbackExtractor.extract('English text 🚀\n\nنص عربي 👍');
    expect(result.blocks).toEqual([
      { type: 'document', text: '', metadata: { generatedRoot: true } },
      { type: 'paragraph', text: 'English text 🚀', metadata: {} },
      { type: 'paragraph', text: 'نص عربي 👍', metadata: {} }
    ]);
  });

  describe('Invariant: fullText and blocks consistency', () => {
    it('concatenated block text represents only source content', () => {
      const input = 'Para 1\n\nPara 2\n\nPara 3';
      const result = TextFallbackExtractor.extract(input);
      
      const concatenatedBlocks = result.blocks.map(b => b.text).join('');
      
      // Since paragraph normalization explicitly removes the '\n\n' separators
      // from the block contents, we verify that all concatenated block text 
      // exists within the original fullText.
      for (const block of result.blocks) {
        expect(result.fullText).toContain(block.text);
      }
      
      // Order is stable and matches source order
      expect(result.blocks[1].text).toBe('Para 1');
      expect(result.blocks[2].text).toBe('Para 2');
      expect(result.blocks[3].text).toBe('Para 3');
    });
  });
});
