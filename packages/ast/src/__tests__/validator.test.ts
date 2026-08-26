import { describe, it, expect } from 'vitest';
import { ASTValidator } from '../validator';
import { ASTNode } from '../types';

describe('ASTValidator', () => {
  it('should validate a perfect AST', () => {
    const nodes: ASTNode[] = [
      { id: '1', parent_id: null, node_type: 'document', lexo_rank: 'a' },
      { id: '2', parent_id: '1', node_type: 'heading', lexo_rank: 'b', content: { level: 1, text: 'Title' } },
      { id: '3', parent_id: '1', node_type: 'paragraph', lexo_rank: 'c', content: { text: 'Hello World' } },
    ];
    
    const result = ASTValidator.validate(nodes);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.statistics.nodeCount).toBe(3);
    expect(result.statistics.rootCount).toBe(1);
    expect(result.statistics.maxDepth).toBe(2);
    expect(result.statistics.cycleCount).toBe(0);
  });

  it('should detect orphan nodes (missing parent)', () => {
    const nodes: ASTNode[] = [
      { id: '1', parent_id: null, node_type: 'document', lexo_rank: 'a' },
      { id: '2', parent_id: 'non-existent', node_type: 'paragraph', lexo_rank: 'b', content: { text: 'Orphan' } },
    ];
    
    const result = ASTValidator.validate(nodes);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ORPHAN_NODE')).toBe(true);
  });

  it('should detect zero roots', () => {
    const nodes: ASTNode[] = [
      { id: '1', parent_id: '2', node_type: 'paragraph', lexo_rank: 'a' },
      { id: '2', parent_id: '1', node_type: 'paragraph', lexo_rank: 'b' },
    ];
    
    const result = ASTValidator.validate(nodes);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ZERO_ROOTS')).toBe(true);
    expect(result.errors.some(e => e.code === 'CIRCULAR_HIERARCHY')).toBe(true);
  });

  it('should detect multiple roots', () => {
    const nodes: ASTNode[] = [
      { id: '1', parent_id: null, node_type: 'document', lexo_rank: 'a' },
      { id: '2', parent_id: null, node_type: 'document', lexo_rank: 'b' },
    ];
    
    const result = ASTValidator.validate(nodes);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MULTI_ROOT')).toBe(true);
  });

  it('should detect circular hierarchy (A -> B -> C -> A)', () => {
    const nodes: ASTNode[] = [
      { id: '1', parent_id: null, node_type: 'document', lexo_rank: 'a' },
      { id: 'A', parent_id: '1', node_type: 'section', lexo_rank: 'b' },
      { id: 'B', parent_id: 'A', node_type: 'section', lexo_rank: 'c' },
      { id: 'C', parent_id: 'B', node_type: 'section', lexo_rank: 'd' },
    ];
    // Create the cycle A -> B -> C -> A
    nodes[1].parent_id = 'C';
    
    const result = ASTValidator.validate(nodes);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CIRCULAR_HIERARCHY')).toBe(true);
  });

  it('should detect duplicate LexoRanks among siblings', () => {
    const nodes: ASTNode[] = [
      { id: '1', parent_id: null, node_type: 'document', lexo_rank: 'a' },
      { id: '2', parent_id: '1', node_type: 'paragraph', lexo_rank: 'same_rank' },
      { id: '3', parent_id: '1', node_type: 'paragraph', lexo_rank: 'same_rank' }, // collision
    ];
    
    const result = ASTValidator.validate(nodes);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DUPLICATE_LEXO_RANK')).toBe(true);
  });

  it('should detect broken and cyclic relationships', () => {
    const nodes: ASTNode[] = [
      { id: '1', parent_id: null, node_type: 'document', lexo_rank: 'a', relationships: [
        { target_id: 'non-existent', type: 'internal_link' },
        { target_id: '1', type: 'internal_link' }, // self-cycle
        { target_id: '1', type: 'invalid_type' }
      ] },
    ];
    
    const result = ASTValidator.validate(nodes);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BROKEN_RELATIONSHIP')).toBe(true);
    expect(result.errors.some(e => e.code === 'SELF_RELATIONSHIP_CYCLE')).toBe(true);
    expect(result.errors.some(e => e.code === 'INVALID_RELATIONSHIP_TYPE')).toBe(true);
  });

  it('should detect invalid annotations and assets', () => {
    const nodes: ASTNode[] = [
      { id: '1', parent_id: null, node_type: 'document', lexo_rank: 'a', 
        annotations: [
          { start_offset: 10, end_offset: 5, exact_text: 'bad' } // end < start
        ],
        assets: [
          { id: 'asset-1', asset_type: 'unknown' }
        ]
      },
    ];
    
    const result = ASTValidator.validate(nodes);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_ANNOTATION_OFFSETS')).toBe(true);
    expect(result.errors.some(e => e.code === 'INVALID_ASSET_TYPE')).toBe(true);
  });

  it('should validate a 100,000-node AST workload', () => {
    const nodes: ASTNode[] = [];
    nodes.push({ id: 'root', parent_id: null, node_type: 'document', lexo_rank: 'root' });
    
    const COUNT = 100000;
    for (let i = 1; i < COUNT; i++) {
      nodes.push({
        id: `node-${i}`,
        parent_id: Math.floor((i - 1) / 5) === 0 ? 'root' : `node-${Math.floor((i - 1) / 5)}`,
        node_type: 'paragraph',
        lexo_rank: `rank-${i}`,
        content: { text: 'load testing' }
      });
    }

    const result = ASTValidator.validate(nodes);

    if (!result.valid) {
      console.log('100k test failed with errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.statistics.nodeCount).toBe(COUNT);
  });
});
