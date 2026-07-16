import { BuilderContext, BuilderPass } from '../types';
import { generateDeterministicId } from '../utils/uuid';

export class Pass3Identity implements BuilderPass {
  name = 'DeterministicIdentity';

  execute(ctx: BuilderContext): void {
    const docId = ctx.options.documentId;
    
    // First pass: generate all self UUIDs
    for (let i = 0; i < ctx.dtos.length; i++) {
      const dto = ctx.dtos[i];
      if (dto.extractor_id) {
        const uuid = generateDeterministicId(docId, dto.extractor_id);
        ctx.setCanonicalId(i, uuid);
      }
    }

    // Second pass: resolve parent UUIDs
    for (let i = 0; i < ctx.dtos.length; i++) {
      const dto = ctx.dtos[i];
      if (dto.extractor_parent_id) {
        const parentIndex = ctx.dtoIndexMap.get(dto.extractor_parent_id);
        if (parentIndex !== undefined) {
          const parentUuid = ctx.dtos[parentIndex]._canonical_id;
          if (parentUuid) {
            ctx.setCanonicalParentId(i, parentUuid);
          }
        }
      } else {
        ctx.setCanonicalParentId(i, null);
      }
    }
  }
}
