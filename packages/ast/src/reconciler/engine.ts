import { RelationshipManifest } from '../manifest';
import { 
  ManifestState, 
  ResolutionDiagnostic, 
  ResolvedEdge, 
  ResolutionResult, 
  ResolutionMetrics 
} from './types';
import { generateEdgeId } from './utils/uuid';

export class RelationshipResolutionEngine {
  /**
   * Resolves a batch of Relationship Manifests into canonical edges.
   * 
   * @param manifests Immutable array of manifest entries.
   * @param lookupIndex Pre-built map of `extractor_id -> canonical_uuid` for the entire document.
   * @returns ResolutionResult containing resolved edges and diagnostics.
   */
  static resolve(
    manifests: RelationshipManifest[],
    lookupIndex: Map<string, string>
  ): ResolutionResult {
    const startTime = Date.now();
    
    const edges: ResolvedEdge[] = [];
    const diagnostics: ResolutionDiagnostic[] = [];
    
    const metrics: ResolutionMetrics = {
      processed: manifests.length,
      resolved: 0,
      pending: 0,
      failed: 0,
      retry: 0,
      duration_ms: 0
    };

    for (const manifest of manifests) {
      const now = new Date().toISOString();
      
      // 1. Validate target exists in index
      const targetCanonicalId = lookupIndex.get(manifest.target_extractor_id);
      
      if (!targetCanonicalId) {
        // Target is missing. Cannot resolve.
        // We log a diagnostic and mark as FAILED for now (or RETRY if we support pending loops)
        diagnostics.push({
          manifest_id: manifest.manifest_id,
          state: ManifestState.FAILED,
          error_code: 'MISSING_TARGET',
          message: `Target extractor ID '${manifest.target_extractor_id}' not found in Document Index.`,
          timestamp: now
        });
        metrics.failed++;
        continue;
      }

      // 2. Generate edge deterministically
      const edgeId = generateEdgeId(
        manifest.document_id,
        manifest.source_canonical_id,
        targetCanonicalId,
        manifest.relationship_type
      );

      // 3. Bind edge
      edges.push({
        edge_id: edgeId,
        source_node_id: manifest.source_canonical_id,
        target_node_id: targetCanonicalId,
        relationship_type: manifest.relationship_type
      });
      
      // 4. Log success
      diagnostics.push({
        manifest_id: manifest.manifest_id,
        state: ManifestState.RESOLVED,
        timestamp: now
      });
      metrics.resolved++;
    }

    metrics.duration_ms = Date.now() - startTime;

    return {
      edges,
      diagnostics,
      metrics
    };
  }
}
