import { describe, it, expect } from 'vitest';
import { RelationshipResolutionEngine } from '../engine';
import { RelationshipManifest } from '../../manifest/types';
import { ManifestState } from '../types';

describe('RelationshipResolutionEngine', () => {
  it('should successfully resolve a manifest when target exists', () => {
    const manifest: RelationshipManifest = {
      manifest_id: 'm1',
      manifest_version: '1.0',
      document_id: 'doc-1',
      chunk_id: 'chunk-1',
      source_canonical_id: 'uuid-source-1',
      source_extractor_id: 'block-1',
      target_extractor_id: 'block-2',
      relationship_type: 'citation',
      diagnostics: { builder_version: '1', created_at: 'now' }
    };

    const index = new Map<string, string>();
    index.set('block-2', 'uuid-target-2');

    const result = RelationshipResolutionEngine.resolve([manifest], index);

    expect(result.metrics.processed).toBe(1);
    expect(result.metrics.resolved).toBe(1);
    expect(result.metrics.failed).toBe(0);
    
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].source_node_id).toBe('uuid-source-1');
    expect(result.edges[0].target_node_id).toBe('uuid-target-2');
    expect(result.edges[0].edge_id).toBeDefined();

    expect(result.diagnostics.length).toBe(1);
    expect(result.diagnostics[0].state).toBe(ManifestState.RESOLVED);
  });

  it('should fail and output diagnostics if target does not exist', () => {
    const manifest: RelationshipManifest = {
      manifest_id: 'm2',
      manifest_version: '1.0',
      document_id: 'doc-1',
      chunk_id: 'chunk-1',
      source_canonical_id: 'uuid-source-1',
      source_extractor_id: 'block-1',
      target_extractor_id: 'block-missing',
      relationship_type: 'citation',
      diagnostics: { builder_version: '1', created_at: 'now' }
    };

    const index = new Map<string, string>();

    const result = RelationshipResolutionEngine.resolve([manifest], index);

    expect(result.metrics.processed).toBe(1);
    expect(result.metrics.resolved).toBe(0);
    expect(result.metrics.failed).toBe(1);
    
    expect(result.edges.length).toBe(0);

    expect(result.diagnostics.length).toBe(1);
    expect(result.diagnostics[0].state).toBe(ManifestState.FAILED);
    expect(result.diagnostics[0].error_code).toBe('MISSING_TARGET');
  });

  it('should be deterministic and idempotent in edge UUID generation', () => {
    const manifest: RelationshipManifest = {
      manifest_id: 'm1',
      manifest_version: '1.0',
      document_id: 'doc-1',
      chunk_id: 'chunk-1',
      source_canonical_id: 'uuid-source-1',
      source_extractor_id: 'block-1',
      target_extractor_id: 'block-2',
      relationship_type: 'citation',
      diagnostics: { builder_version: '1', created_at: 'now' }
    };

    const index = new Map<string, string>();
    index.set('block-2', 'uuid-target-2');

    const result1 = RelationshipResolutionEngine.resolve([manifest], index);
    const result2 = RelationshipResolutionEngine.resolve([manifest], index);

    expect(result1.edges[0].edge_id).toBe(result2.edges[0].edge_id);
  });
});
