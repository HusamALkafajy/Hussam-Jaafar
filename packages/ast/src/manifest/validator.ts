import { RelationshipManifest, RelationshipManifestValidationResult } from './types';

export class ManifestValidator {
  /**
   * Validates a Relationship Manifest for structural and semantic correctness.
   * This is a pure function.
   */
  static validate(manifest: RelationshipManifest): RelationshipManifestValidationResult {
    const errors: string[] = [];

    if (!manifest) {
      return { valid: false, errors: ['Manifest is null or undefined'] };
    }

    if (!manifest.manifest_id || manifest.manifest_id.length !== 36) {
      errors.push('Missing or invalid manifest_id (must be UUID)');
    }
    
    if (!manifest.manifest_version || typeof manifest.manifest_version !== 'string') {
      errors.push('Missing or invalid manifest_version');
    }

    if (!manifest.document_id || typeof manifest.document_id !== 'string') {
      errors.push('Missing or invalid document_id');
    }

    if (!manifest.chunk_id || typeof manifest.chunk_id !== 'string') {
      errors.push('Missing or invalid chunk_id');
    }

    if (!manifest.source_canonical_id || typeof manifest.source_canonical_id !== 'string') {
      errors.push('Missing or invalid source_canonical_id');
    }

    if (!manifest.source_extractor_id || typeof manifest.source_extractor_id !== 'string') {
      errors.push('Missing or invalid source_extractor_id');
    }

    if (!manifest.target_extractor_id || typeof manifest.target_extractor_id !== 'string') {
      errors.push('Missing or invalid target_extractor_id');
    }

    if (!manifest.relationship_type || typeof manifest.relationship_type !== 'string') {
      errors.push('Missing or invalid relationship_type');
    }

    if (manifest.source_extractor_id === manifest.target_extractor_id) {
      errors.push('source_extractor_id cannot equal target_extractor_id (self-referencing edges are forbidden in manifest)');
    }

    if (!manifest.diagnostics || typeof manifest.diagnostics !== 'object') {
      errors.push('Missing or invalid diagnostics object');
    } else {
      if (!manifest.diagnostics.builder_version) errors.push('Missing diagnostics.builder_version');
      if (!manifest.diagnostics.created_at) errors.push('Missing diagnostics.created_at');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateAll(manifests: RelationshipManifest[]): RelationshipManifestValidationResult {
    if (!Array.isArray(manifests)) {
      return { valid: false, errors: ['Input is not an array of manifests'] };
    }

    const allErrors: string[] = [];
    
    for (let i = 0; i < manifests.length; i++) {
      const result = this.validate(manifests[i]);
      if (!result.valid) {
        allErrors.push(`Manifest at index ${i} failed: ${result.errors.join(', ')}`);
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }
}
