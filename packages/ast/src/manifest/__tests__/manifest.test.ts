import { describe, it, expect } from 'vitest';
import { ManifestValidator } from '../validator';
import { RelationshipManifest } from '../types';

describe('RelationshipManifestValidator', () => {
  it('should validate a correct manifest', () => {
    const manifest: RelationshipManifest = {
      manifest_id: '1b671a64-40d5-491e-99b0-da01ff1f3341',
      manifest_version: '1.0.0',
      document_id: 'doc-1',
      chunk_id: 'chunk-1',
      source_canonical_id: 'uuid-1',
      source_extractor_id: 'block_1',
      target_extractor_id: 'block_2',
      relationship_type: 'footnote',
      diagnostics: {
        builder_version: '2.0.0',
        created_at: '2026-06-28T00:00:00Z'
      }
    };

    const result = ManifestValidator.validate(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should reject a manifest missing manifest_id', () => {
    const manifest = {
      manifest_version: '1.0.0',
      document_id: 'doc-1',
      chunk_id: 'chunk-1',
      source_canonical_id: 'uuid-1',
      source_extractor_id: 'block_1',
      target_extractor_id: 'block_2',
      relationship_type: 'footnote',
      diagnostics: {
        builder_version: '2.0.0',
        created_at: '2026-06-28T00:00:00Z'
      }
    } as any;

    const result = ManifestValidator.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid manifest_id (must be UUID)');
  });

  it('should reject self-referencing manifests', () => {
    const manifest: RelationshipManifest = {
      manifest_id: '1b671a64-40d5-491e-99b0-da01ff1f3341',
      manifest_version: '1.0.0',
      document_id: 'doc-1',
      chunk_id: 'chunk-1',
      source_canonical_id: 'uuid-1',
      source_extractor_id: 'block_1',
      target_extractor_id: 'block_1',
      relationship_type: 'footnote',
      diagnostics: {
        builder_version: '2.0.0',
        created_at: '2026-06-28T00:00:00Z'
      }
    };

    const result = ManifestValidator.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('source_extractor_id cannot equal target_extractor_id (self-referencing edges are forbidden in manifest)');
  });
});
