import { BuilderContext, BuilderPass } from '../types';

export class Pass5Relationships implements BuilderPass {
  name = 'RelationshipResolution';

  execute(ctx: BuilderContext): void {
    for (let i = 0; i < ctx.dtos.length; i++) {
      const dto = ctx.dtos[i];
      if (dto.relationships && dto.relationships.length > 0) {
        const canonicalRels: Array<{ target_id: string, type: string }> = [];
        
        for (const rel of dto.relationships) {
          if (!rel.target_extractor_id) {
            ctx.reportError({
              code: 'INVALID_RELATIONSHIP',
              message: 'Relationship is missing target_extractor_id',
              extractorId: dto.extractor_id
            });
            continue;
          }

          const targetIndex = ctx.dtoIndexMap.get(rel.target_extractor_id);
          if (targetIndex !== undefined) {
            const canonicalTargetId = ctx.dtos[targetIndex]._canonical_id;
            if (canonicalTargetId) {
              canonicalRels.push({
                target_id: canonicalTargetId,
                type: rel.type || 'internal_link'
              });
            }
          } else {
            ctx.reportError({
              code: 'BROKEN_RELATIONSHIP',
              message: `Relationship target '${rel.target_extractor_id}' not found in payload`,
              extractorId: dto.extractor_id
            });
          }
        }
        ctx.setCanonicalRelationships(i, canonicalRels);
      }
    }
  }
}
