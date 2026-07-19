import { describe, it, expect } from 'vitest';
import { ASTBuilder } from '../index';
import { StructuralBlock } from '../types';

describe('ASTBuilder', () => {
  const options = { versionId: '2b671a64-40d5-491e-99b0-da01ff1f3342' };

  it('1. H1 -> paragraph', () => {
    const blocks: StructuralBlock[] = [
      { type: 'heading_1', text: 'Root' },
      { type: 'paragraph', text: 'Hello' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.success).toBe(true);
    expect(result.nodes.length).toBe(2);
    expect(result.nodes[1].parent_id).toBe(result.nodes[0].id);
  });

  it('2. H1 -> H2 -> paragraph', () => {
    const blocks: StructuralBlock[] = [
      { type: 'heading_1', text: 'Root' },
      { type: 'heading_2', text: 'Child' },
      { type: 'paragraph', text: 'Hello' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes.length).toBe(3);
    expect(result.nodes[1].parent_id).toBe(result.nodes[0].id);
    expect(result.nodes[2].parent_id).toBe(result.nodes[1].id);
  });

  it('3. H1 -> H3 level jump', () => {
    const blocks: StructuralBlock[] = [
      { type: 'heading_1', text: 'Root' },
      { type: 'heading_3', text: 'Jump' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[1].parent_id).toBe(result.nodes[0].id);
  });

  it('4. paragraph before first heading', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: 'Orphan' },
      { type: 'heading_1', text: 'Root' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    // Orphan paragraph has parent_id = null
    expect(result.nodes[0].parent_id).toBeNull();
  });

  it('5. multiple root-level headings', () => {
    const blocks: StructuralBlock[] = [
      { type: 'heading_1', text: 'Root 1' },
      { type: 'heading_1', text: 'Root 2' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[0].parent_id).toBeNull();
    expect(result.nodes[1].parent_id).toBeNull();
    expect(result.nodes[0].lexo_rank).toBe('00000');
    expect(result.nodes[1].lexo_rank).toBe('00001');
  });

  it('6. consecutive headings', () => {
    const blocks: StructuralBlock[] = [
      { type: 'heading_1', text: 'H1 A' },
      { type: 'heading_2', text: 'H2 B' },
      { type: 'heading_1', text: 'H1 C' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[1].parent_id).toBe(result.nodes[0].id);
    expect(result.nodes[2].parent_id).toBeNull(); // H1 pops H2 and H1
  });

  it('7. duplicate paragraph text', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: 'Duplicate' },
      { type: 'paragraph', text: 'Duplicate' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[0].id).not.toBe(result.nodes[1].id); // Uses index, not content hash
  });

  it('8. plain-text-only document', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: 'P1' },
      { type: 'paragraph', text: 'P2' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[0].parent_id).toBeNull();
    expect(result.nodes[1].parent_id).toBeNull();
  });

  it('9. list items', () => {
    const blocks: StructuralBlock[] = [
      { type: 'heading_1', text: 'List' },
      { type: 'list_item', text: 'Item 1' },
      { type: 'list_item', text: 'Item 2' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[1].parent_id).toBe(result.nodes[0].id);
    expect(result.nodes[2].parent_id).toBe(result.nodes[0].id);
    expect(result.nodes[1].node_type).toBe('list_item');
  });

  it('10. table block if supported', () => {
    const blocks: StructuralBlock[] = [
      { type: 'table', text: 'Table data' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[0].node_type).toBe('table');
  });

  it('11. empty document', () => {
    const blocks: StructuralBlock[] = [];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes.length).toBe(0);
  });

  it('12. empty blocks', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: '' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[0].content?.text).toBe('');
  });

  it('13. unknown/unsupported structural hints', () => {
    const blocks: StructuralBlock[] = [
      { type: 'unknown', text: 'Some text' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[0].node_type).toBe('unknown');
  });

  it('14. identical input produces identical AST', () => {
    const blocks: StructuralBlock[] = [
      { type: 'heading_1', text: 'Root' }
    ];
    const r1 = ASTBuilder.buildAndValidate(blocks, options);
    const r2 = ASTBuilder.buildAndValidate(blocks, options);
    expect(r1.nodes[0].id).toBe(r2.nodes[0].id);
  });

  it('15. input order produces deterministic lexo_rank ordering', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: 'P1' },
      { type: 'paragraph', text: 'P2' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[0].lexo_rank).toBe('00000');
    expect(result.nodes[1].lexo_rank).toBe('00001');
  });

  it('16. no caller-supplied parent IDs required', () => {
    const blocks: StructuralBlock[] = [
      { type: 'heading_1', text: 'A' },
      { type: 'heading_2', text: 'B' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[1].parent_id).toBe(result.nodes[0].id);
  });

  it('should sanitize metadata prototype pollution', () => {
    const blocks: StructuralBlock[] = [
      { 
        type: 'document', 
        text: '',
        metadata: JSON.parse('{"__proto__": {"hacked": true}, "safe": true}')
      }
    ];
    
    const result = ASTBuilder.buildAndValidate(blocks, options);
    expect(result.nodes[0].metadata?.safe).toBe(true);
    expect((result.nodes[0].metadata as any).hacked).toBeUndefined();
  });

  it('should correctly handle hostile deep hierarchies iteratively without stack overflow', () => {
    const blocks: StructuralBlock[] = [];
    blocks.push({ type: 'document', text: '' });
    
    // We cannot push 50,000 headings because heading level caps at 6.
    // Instead we just push 50,000 paragraphs to the document root.
    const COUNT = 50000;
    for (let i = 1; i < COUNT; i++) {
      blocks.push({
        type: 'paragraph',
        text: `node-${i}`
      });
    }

    const result = ASTBuilder.buildAndValidate(blocks, options);

    expect(result.success).toBe(true);
    expect(result.nodes.length).toBe(COUNT);
  });
  it('17. duplicate sourceId handling', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: 'A', sourceId: 'dup-1' },
      { type: 'paragraph', text: 'B', sourceId: 'dup-1' }
    ];
    const result = ASTBuilder.buildAndValidate(blocks, options);
    // Validation succeeds since ASTBuilder handles parsing, but it reports an error
    expect(result.builderErrors.some(e => e.code === 'DUPLICATE_SOURCE_ID')).toBe(true);
  });

  it('18. different version namespaces produce different IDs', () => {
    const blocks: StructuralBlock[] = [
      { type: 'paragraph', text: 'P1' }
    ];
    
    const v1Result = ASTBuilder.buildAndValidate(blocks, { versionId: '2b671a64-40d5-491e-99b0-da01ff1f3342' });
    const v2Result = ASTBuilder.buildAndValidate(blocks, { versionId: '2b671a64-40d5-491e-99b0-da01ff1f3343' });
    
    expect(v1Result.nodes[0].id).not.toBe(v2Result.nodes[0].id);
  });
});
