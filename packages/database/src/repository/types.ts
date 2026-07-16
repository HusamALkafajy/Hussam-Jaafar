export interface RepositoryDiagnostics {
  inserted_rows: number;
  updated_rows: number;
  skipped_rows: number;
  retries: number;
  constraint_violations: number;
  chunk_duration_ms: number;
  commit_duration_ms: number;
  rollback_duration_ms: number;
  deadlocks: number;
}

export interface PersistenceResult {
  success: boolean;
  diagnostics: RepositoryDiagnostics;
  error?: Error;
}

export interface DocumentRepositoryConfig {
  chunkSize?: number; // Configurable batch size
}
