import { ASTNode, ValidationIssue } from '../types';

export type StructuralBlockType = 
  | 'document'
  | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'heading_5' | 'heading_6'
  | 'paragraph' | 'list_item' | 'table' | 'code' | 'quote' | 'image' | 'unknown';

export interface StructuralBlock {
  type: StructuralBlockType;
  text: string;
  sourceId?: string;
  metadata?: Record<string, any>;
}

// Internal representation used during passes
export interface BuilderNode {
  block: StructuralBlock;
  index: number;
  
  // Mutable injected properties via Builder Passes
  _canonical_id?: string;
  _canonical_parent_id?: string | null;
  _lexo_rank?: string;
}

export interface BuilderError {
  code: string;
  message: string;
  extractorId?: string;
}

export interface BuilderOptions {
  versionId: string;
  initialLexoRank?: string;
}

export class BuilderContext {
  public errors: BuilderError[] = [];
  public nodes: BuilderNode[];
  public options: BuilderOptions;

  constructor(blocks: StructuralBlock[], options: BuilderOptions) {
    this.nodes = blocks.map((block, index) => ({ block, index }));
    this.options = options;
  }

  public reportError(error: BuilderError): void {
    this.errors.push(error);
  }

  public setCanonicalId(index: number, id: string): void {
    this.nodes[index]._canonical_id = id;
  }

  public setCanonicalParentId(index: number, parentId: string | null): void {
    this.nodes[index]._canonical_parent_id = parentId;
  }

  public setLexoRank(index: number, rank: string): void {
    this.nodes[index]._lexo_rank = rank;
  }
}

export interface BuilderPass {
  name: string;
  execute(ctx: BuilderContext): void;
}
