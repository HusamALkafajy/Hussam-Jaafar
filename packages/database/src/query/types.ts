export interface QueryDiagnostics {
  duration_ms: number;
  rows_returned: number;
  cursor_position?: string;
  window_size?: number;
  db_latency_ms?: number;
}

export interface QueryResult<T> {
  data: T;
  diagnostics: QueryDiagnostics;
}

export interface NodeResult {
  id: string;
  parentId: string | null;
  lexoRank: string;
  nodeType: string;
  content: any;
  metadata: any;
}
