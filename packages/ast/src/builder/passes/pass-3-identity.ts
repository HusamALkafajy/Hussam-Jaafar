import { BuilderContext, BuilderPass } from '../types';
import { generateDeterministicId } from '../utils/uuid';

export class Pass3Identity implements BuilderPass {
  name = 'DeterministicIdentity';

  execute(ctx: BuilderContext): void {
    const versionId = ctx.options.versionId;
    
    // First pass: generate all self UUIDs
    for (let i = 0; i < ctx.nodes.length; i++) {
      const node = ctx.nodes[i];
      // Use sourceId if provided, otherwise use array index which is stable for this version
      const identityBase = node.block.sourceId ? node.block.sourceId : `index_${i}`;
      const uuid = generateDeterministicId(versionId, identityBase);
      ctx.setCanonicalId(i, uuid);
    }

    // Second pass: resolve parent UUIDs
    for (let i = 0; i < ctx.nodes.length; i++) {
      const node = ctx.nodes[i];
      const parentRef = node._canonical_parent_id; // temporarily holds "INDEX:X" or null
      
      if (parentRef && parentRef.startsWith('INDEX:')) {
        const parentIndex = parseInt(parentRef.substring(6), 10);
        const parentUuid = ctx.nodes[parentIndex]._canonical_id;
        if (parentUuid) {
          ctx.setCanonicalParentId(i, parentUuid);
        } else {
          ctx.setCanonicalParentId(i, null);
        }
      } else {
        ctx.setCanonicalParentId(i, null);
      }
    }
  }
}
