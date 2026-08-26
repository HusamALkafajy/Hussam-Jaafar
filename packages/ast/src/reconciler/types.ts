import { RelationshipManifest } from '../manifest';

export enum ManifestState {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  FAILED = 'FAILED',
  RETRY = 'RETRY',
  EXPIRED = 'EXPIRED'
}

export interface ResolvedEdge {
  edge_id: string; // Deterministic UUIDv5
  source_node_id: string; // Canonical UUID
  target_node_id: string; // Canonical UUID
  relationship_type: string;
}

export interface ResolutionDiagnostic {
  manifest_id: string;
  state: ManifestState;
  error_code?: string; // 'MISSING_TARGET', 'CORRUPT_MANIFEST', 'EXPIRED'
  message?: string;
  timestamp: string;
}

export interface ResolutionResult {
  edges: ResolvedEdge[];
  diagnostics: ResolutionDiagnostic[];
  metrics: ResolutionMetrics;
}

export interface ResolutionMetrics {
  processed: number;
  resolved: number;
  pending: number;
  failed: number;
  retry: number;
  duration_ms: number;
}
