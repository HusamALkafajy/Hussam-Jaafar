export interface RelationshipManifestDiagnostics {
  extractor_version?: string;
  builder_version: string;
  created_at: string;
}

export interface RelationshipManifest {
  manifest_id: string; // Deterministic UUIDv5
  manifest_version: string; // e.g., '1.0.0'
  
  document_id: string;
  chunk_id: string;
  
  source_canonical_id: string;
  source_extractor_id: string;
  target_extractor_id: string;
  relationship_type: string;
  
  diagnostics: RelationshipManifestDiagnostics;
}

export interface RelationshipManifestValidationResult {
  valid: boolean;
  errors: string[];
}
