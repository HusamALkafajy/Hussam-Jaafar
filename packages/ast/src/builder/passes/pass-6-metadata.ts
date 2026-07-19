import { BuilderContext, BuilderPass } from '../types';
import { ASTNode } from '../../types';

export class Pass6Metadata implements BuilderPass {
  name = 'MetadataNormalization';

  execute(ctx: BuilderContext): void {
    for (let i = 0; i < ctx.nodes.length; i++) {
      const node = ctx.nodes[i];
      if (!node.block.metadata) node.block.metadata = {};
      
      // Inject source tracker
      node.block.metadata['_source_id'] = node.block.sourceId || `index_${i}`;
    }
  }

  static finalize(ctx: BuilderContext): ASTNode[] {
    const nodes: ASTNode[] = [];
    
    for (let i = 0; i < ctx.nodes.length; i++) {
      const node = ctx.nodes[i];
      
      if (!node._canonical_id) {
        ctx.reportError({
          code: 'MISSING_CANONICAL_ID',
          message: 'Failed to generate canonical ID for node'
        });
        continue;
      }

      let astNodeType = node.block.type as string;
      if (astNodeType.startsWith('heading_')) {
        astNodeType = 'heading';
      }
      
      // Map heading level if it's a heading
      const content: Record<string, any> = { text: node.block.text };
      if (node.block.type.startsWith('heading_')) {
        content['level'] = parseInt(node.block.type.split('_')[1], 10);
      }

      nodes.push({
        id: node._canonical_id,
        parent_id: node._canonical_parent_id || null,
        node_type: astNodeType,
        lexo_rank: node._lexo_rank || '00000',
        content: content,
        metadata: node.block.metadata,
      });
    }

    return nodes;
  }
}
