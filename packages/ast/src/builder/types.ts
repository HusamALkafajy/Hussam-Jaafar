import { ASTNode, ValidationIssue } from '../types';

export interface BuilderDTO {
  extractor_id: string;
  extractor_parent_id: string | null;
  node_type: string;
  
  content?: Record<string, any>;
  metadata?: Record<string, any>;
  annotations?: Array<{ start_offset: number, end_offset: number, exact_text: string }>;
  relationships?: Array<{ target_extractor_id: string, type: string }>;
  assets?: Array<{ asset_id: string, asset_type: string }>;

  // Mutable injected properties via Builder Passes
  _canonical_id?: string;
  _canonical_parent_id?: string | null;
  _lexo_rank?: string;
  _canonical_relationships?: Array<{ target_id: string, type: string }>;
}

export interface BuilderError {
  code: string;
  message: string;
  extractorId?: string;
}

export interface BuilderOptions {
  documentId: string;
  initialLexoRank?: string;
}

export class BuilderContext {
  public errors: BuilderError[] = [];
  public dtos: BuilderDTO[];
  public options: BuilderOptions;

  // Internal indices for fast lookups
  public dtoIndexMap: Map<string, number> = new Map();

  constructor(dtos: BuilderDTO[], options: BuilderOptions) {
    this.dtos = dtos;
    this.options = options;
    
    for (let i = 0; i < dtos.length; i++) {
      if (dtos[i].extractor_id) {
        this.dtoIndexMap.set(dtos[i].extractor_id, i);
      }
    }
  }

  public reportError(error: BuilderError): void {
    this.errors.push(error);
  }

  // Controlled Mutators to preserve V8 hidden classes and avoid hidden traps
  public setCanonicalId(index: number, id: string): void {
    this.dtos[index]._canonical_id = id;
  }

  public setCanonicalParentId(index: number, parentId: string | null): void {
    this.dtos[index]._canonical_parent_id = parentId;
  }

  public setLexoRank(index: number, rank: string): void {
    this.dtos[index]._lexo_rank = rank;
  }

  public setCanonicalRelationships(index: number, rels: Array<{ target_id: string, type: string }>): void {
    this.dtos[index]._canonical_relationships = rels;
  }
}

export interface BuilderPass {
  name: string;
  execute(ctx: BuilderContext): void;
}
