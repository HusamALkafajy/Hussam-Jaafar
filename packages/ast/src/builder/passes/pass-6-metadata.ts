import { BuilderContext, BuilderPass } from '../types';
import { ASTNode } from '../../types';

export class Pass6Metadata implements BuilderPass {
  name = 'MetadataNormalization';

  execute(ctx: BuilderContext): void {
    // This pass technically just prepares the context to be exported to ASTNode[]
    // Since ASTNode[] requires specific shapes, we ensure metadata is an object here
    // and content is an object.
    for (let i = 0; i < ctx.dtos.length; i++) {
      const dto = ctx.dtos[i];
      if (!dto.metadata) dto.metadata = {};
      if (!dto.content) dto.content = {};
      
      // Inject source tracker
      dto.metadata['_extractor_id'] = dto.extractor_id;
    }
  }

  static finalize(ctx: BuilderContext): ASTNode[] {
    const nodes: ASTNode[] = [];
    
    for (let i = 0; i < ctx.dtos.length; i++) {
      const dto = ctx.dtos[i];
      
      if (!dto._canonical_id) {
        // Critical invariant failure
        ctx.reportError({
          code: 'MISSING_CANONICAL_ID',
          message: 'Failed to generate canonical ID for node',
          extractorId: dto.extractor_id
        });
        continue;
      }

      nodes.push({
        id: dto._canonical_id,
        parent_id: dto._canonical_parent_id || null,
        node_type: dto.node_type || 'unknown',
        lexo_rank: dto._lexo_rank || '00000',
        content: dto.content,
        metadata: dto.metadata,
        annotations: dto.annotations,
        assets: dto.assets ? dto.assets.map((a: any) => ({ id: a.asset_id, asset_type: a.asset_type })) : undefined,
        relationships: dto._canonical_relationships,
      });
    }

    return nodes;
  }
}
