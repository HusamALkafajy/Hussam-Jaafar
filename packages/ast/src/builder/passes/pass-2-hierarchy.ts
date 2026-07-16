import { BuilderContext, BuilderPass } from '../types';

export class Pass2Hierarchy implements BuilderPass {
  name = 'HierarchyResolution';

  execute(ctx: BuilderContext): void {
    // Determine the root. We assume parent pointers might be invalid or circular.
    // However, the builder only connects explicit parent pointers. 
    // Cycle detection will happen in the Validator, but we must ensure we don't crash.
    // The only thing we do here is resolve extractor_parent_id to canonical_parent_id (which is currently just setting it).
    // Wait, since canonical_id is generated in Pass 3, how do we set canonical_parent_id?
    // We need canonical_ids FIRST.
    // Let's swap the logic logically:
    // Actually, Pass 3 (UUID generation) can run BEFORE Pass 2 (Hierarchy), or Pass 2 just resolves the index, but we don't need index.
    // We can just rely on Pass 3 having run, OR we can generate IDs first.
    // The design doc said: Pass 2 Hierarchy, Pass 3 Deterministic UUID.
    // Let's just do Hierarchy validation here: does the parent exist?
    
    for (let i = 0; i < ctx.dtos.length; i++) {
      const dto = ctx.dtos[i];
      if (dto.extractor_parent_id !== null) {
        if (!ctx.dtoIndexMap.has(dto.extractor_parent_id)) {
          ctx.reportError({
            code: 'INVALID_PARENT_REFERENCE',
            message: `Parent extractor_id '${dto.extractor_parent_id}' does not exist`,
            extractorId: dto.extractor_id
          });
          // Unlink it so downstream doesn't crash, but error is logged
          dto.extractor_parent_id = null;
        }
      }
    }
  }
}
