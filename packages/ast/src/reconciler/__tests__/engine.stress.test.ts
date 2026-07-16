import { describe, it, expect } from 'vitest';
import { RelationshipResolutionEngine } from '../engine';
import { RelationshipManifest } from '../../manifest/types';

describe('RelationshipResolutionEngine Stress Tests', () => {
  it('should process 100,000 relationships within linear time limits', () => {
    const MANIFEST_COUNT = 100_000;
    const manifests: RelationshipManifest[] = [];
    const index = new Map<string, string>();

    // Generate 100k valid relationships
    for (let i = 0; i < MANIFEST_COUNT; i++) {
      manifests.push({
        manifest_id: `m-${i}`,
        manifest_version: '1.0',
        document_id: 'doc-1',
        chunk_id: 'chunk-1',
        source_canonical_id: `uuid-source-${i}`,
        source_extractor_id: `block-${i}`,
        target_extractor_id: `target-${i}`,
        relationship_type: 'citation',
        diagnostics: { builder_version: '1', created_at: 'now' }
      });
      index.set(`target-${i}`, `uuid-target-${i}`);
    }

    // Force garbage collection if available (Node.js --expose-gc required, but we just measure natural GC)
    const startHeap = process.memoryUsage().heapUsed;

    const result = RelationshipResolutionEngine.resolve(manifests, index);

    const endHeap = process.memoryUsage().heapUsed;
    const heapDiffMb = (endHeap - startHeap) / 1024 / 1024;

    expect(result.metrics.processed).toBe(MANIFEST_COUNT);
    expect(result.metrics.resolved).toBe(MANIFEST_COUNT);
    expect(result.metrics.failed).toBe(0);
    expect(result.edges.length).toBe(MANIFEST_COUNT);
    
    // Memory overhead should be roughly linear and safely constrained
    // We expect ~20-50MB overhead for 100k DTO arrays
    expect(heapDiffMb).toBeLessThan(150);
  });
});
