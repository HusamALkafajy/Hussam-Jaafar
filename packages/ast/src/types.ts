export type ASTNodeType =
  | 'document' | 'section' | 'column' | 'heading' | 'paragraph' | 'quote' | 'code'
  | 'list' | 'list_item' | 'table' | 'table_row' | 'table_cell' | 'image' | 'equation'
  | 'video' | 'audio' | 'footnote' | 'citation' | 'callout' | 'reference_list';

export interface ASTNode {
  id: string;
  parent_id: string | null;
  node_type: string;
  lexo_rank: string;
  content?: Record<string, any>;
  metadata?: Record<string, any>;
  relationships?: ASTRelationship[];
  annotations?: ASTAnnotation[];
  assets?: ASTAsset[];
}

export interface ASTRelationship {
  target_id: string;
  type: string;
}

export interface ASTAnnotation {
  start_offset: number;
  end_offset: number;
  exact_text: string;
}

export interface ASTAsset {
  id: string;
  asset_type: string;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
  nodeId?: string;
  details?: Record<string, any>;
}

export interface DocumentStatistics {
  nodeCount: number;
  relationshipCount: number;
  assetCount: number;
  annotationCount: number;
  maxDepth: number;
  averageBranchingFactor: number;
  rootCount: number;
  leafCount: number;
  cycleCount: number;
  orphanCount: number;
  duplicateCount: number;
  validationDurationMs: number;
  estimatedMemoryUsageBytes: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  statistics: DocumentStatistics;
}

export interface ValidationContext {
  nodes: ASTNode[];
  nodeMap: Map<string, ASTNode>;
  adjacencyList: Map<string | null, string[]>; // parent_id -> child_ids
  rankSetByParent: Map<string | null, Set<string>>;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  reportIssue: (issue: ValidationIssue) => void;
  // Graph analysis metrics
  cyclesDetected: number;
  maxDepth: number;
  leafCount: number;
  orphanCount: number;
  relationshipCount: number;
  annotationCount: number;
  assetCount: number;
}

export interface ValidationRule {
  id: string;
  description: string;
  validate: (ctx: ValidationContext) => void;
}
