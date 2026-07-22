import { CanonicalTextSerializer } from './canonical-text.serializer';
import { StructuralBlock } from '@studyai/ast';

describe('CanonicalTextSerializer', () => {
  it('should serialize empty blocks to empty string', () => {
    expect(CanonicalTextSerializer.serialize([])).toBe('');
    expect(CanonicalTextSerializer.serialize([{ type: 'paragraph', text: '', metadata: {} }])).toBe('');
  });

  it('should join blocks with double newlines', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: 'First block', metadata: {} },
      { type: 'paragraph', text: 'Second block', metadata: {} }
    ];
    expect(CanonicalTextSerializer.serialize(blocks)).toBe('First block\n\nSecond block');
  });

  it('should format list items with markdown bullet', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: 'List intro:', metadata: {} },
      { type: 'list_item', text: 'Item one', metadata: {} },
      { type: 'list_item', text: 'Item two', metadata: {} }
    ];
    expect(CanonicalTextSerializer.serialize(blocks)).toBe('List intro:\n\n- Item one\n\n- Item two');
  });

  it('should trim whitespace but not remove intentional newlines inside blocks', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: '  Indented block  ', metadata: {} },
      { type: 'code', text: '\nconst a = 1;\nconst b = 2;\n', metadata: {} }
    ];
    expect(CanonicalTextSerializer.serialize(blocks)).toBe('Indented block\n\nconst a = 1;\nconst b = 2;');
  });

  it('should serialize headings as plain text', () => {
    const blocks: StructuralBlock[] = [
      { type: 'heading_1', text: 'Main Title', metadata: {} },
      { type: 'heading_2', text: 'Subtitle', metadata: {} },
      { type: 'paragraph', text: 'Content', metadata: {} }
    ];
    expect(CanonicalTextSerializer.serialize(blocks)).toBe('Main Title\n\nSubtitle\n\nContent');
  });

  it('should produce identical output on repeated serialization (deterministic)', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: 'Testing', metadata: {} }
    ];
    const pass1 = CanonicalTextSerializer.serialize(blocks);
    const pass2 = CanonicalTextSerializer.serialize(blocks);
    expect(pass1).toBe(pass2);
  });
});
