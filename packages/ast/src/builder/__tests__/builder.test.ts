import { describe, it, expect } from 'vitest';
import { ASTBuilder } from '../index';
import { BuilderDTO } from '../types';

describe('ASTBuilder', () => {
  const options = { documentId: '2b671a64-40d5-491e-99b0-da01ff1f3342' };

  it('should build a perfect AST and pass validation', () => {
    const dtos: BuilderDTO[] = [
      { extractor_id: 'block_1', extractor_parent_id: null, node_type: 'document' },
      { extractor_id: 'block_2', extractor_parent_id: 'block_1', node_type: 'heading', content: { level: 1 } },
      { extractor_id: 'block_3', extractor_parent_id: 'block_1', node_type: 'paragraph', content: { text: 'Hello' } },
      { extractor_id: 'block_4', extractor_parent_id: 'block_3', node_type: 'code', relationships: [{ target_extractor_id: 'block_2', type: 'internal_link' }] }
    ];
    
    const result = ASTBuilder.buildAndValidate(dtos, options);
    expect(result.success).toBe(true);
    expect(result.builderErrors.length).toBe(0);
    expect(result.nodes.length).toBe(4);
    
    // Check determinism UUIDs
    const block1Uuid = result.nodes[0].id;
    const block2Uuid = result.nodes[1].id;
    expect(block1Uuid.length).toBe(36); // UUID format
    expect(result.nodes[1].parent_id).toBe(block1Uuid);
    
    // Check LexoRank sequentially allocated
    expect(result.nodes[1].lexo_rank).toBe('00000');
    expect(result.nodes[2].lexo_rank).toBe('00001');

    // Check relationship target resolved to canonical UUID
    expect(result.nodes[3].relationships![0].target_id).toBe(block2Uuid);
  });

  it('should sanitize metadata prototype pollution', () => {
    const dtos: BuilderDTO[] = [
      { 
        extractor_id: 'block_1', 
        extractor_parent_id: null, 
        node_type: 'document', 
        metadata: JSON.parse('{"__proto__": {"hacked": true}, "safe": true}')
      }
    ];
    
    const result = ASTBuilder.buildAndValidate(dtos, options);
    expect(result.nodes[0].metadata?.safe).toBe(true);
    expect((result.nodes[0].metadata as any).hacked).toBeUndefined();
  });

  it('should drop broken relationships and record builder error', () => {
    const dtos: BuilderDTO[] = [
      { extractor_id: '1', extractor_parent_id: null, node_type: 'document', relationships: [{ target_extractor_id: 'ghost', type: 'internal_link' }] }
    ];
    
    const result = ASTBuilder.buildAndValidate(dtos, options);
    expect(result.success).toBe(false); // Validation succeeds, but Builder failed
    expect(result.builderErrors.some(e => e.code === 'BROKEN_RELATIONSHIP')).toBe(true);
    expect(result.nodes[0].relationships?.length).toBe(0);
  });

  it('should correctly handle hostile deep hierarchies iteratively without stack overflow', () => {
    const dtos: BuilderDTO[] = [];
    dtos.push({ extractor_id: 'root', extractor_parent_id: null, node_type: 'document' });
    
    // 50,000 deep single-branch tree (A -> B -> C ...)
    // If we used recursion anywhere, it would stack overflow at ~10,000 frames
    const COUNT = 50000;
    for (let i = 1; i < COUNT; i++) {
      dtos.push({
        extractor_id: `node-${i}`,
        extractor_parent_id: i === 1 ? 'root' : `node-${i - 1}`,
        node_type: 'paragraph'
      });
    }


    const result = ASTBuilder.buildAndValidate(dtos, options);

    expect(result.success).toBe(true);
    expect(result.nodes.length).toBe(COUNT);
  });
});
