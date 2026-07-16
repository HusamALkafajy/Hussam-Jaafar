import { BuilderContext, BuilderPass, BuilderDTO } from '../types';

export class Pass1Security implements BuilderPass {
  name = 'SecuritySanitization';

  execute(ctx: BuilderContext): void {
    const seenIds = new Set<string>();

    for (let i = 0; i < ctx.dtos.length; i++) {
      const dto = ctx.dtos[i];

      // 1. Validate Extractor ID exists
      if (!dto.extractor_id || typeof dto.extractor_id !== 'string') {
        ctx.reportError({
          code: 'MISSING_EXTRACTOR_ID',
          message: 'DTO is missing extractor_id',
          extractorId: dto.extractor_id
        });
        continue;
      }

      // 2. Duplicate Extractor ID
      if (seenIds.has(dto.extractor_id)) {
        ctx.reportError({
          code: 'DUPLICATE_EXTRACTOR_ID',
          message: `Duplicate extractor_id detected: ${dto.extractor_id}`,
          extractorId: dto.extractor_id
        });
      }
      seenIds.add(dto.extractor_id);

      // 3. Prototype Pollution and Invalid Object shapes
      this.sanitizeObject(dto.content);
      this.sanitizeObject(dto.metadata);

      // 4. Invalid offsets (negative)
      if (dto.annotations) {
        if (!Array.isArray(dto.annotations)) {
          dto.annotations = [];
        } else {
          for (const ann of dto.annotations) {
            if (ann.start_offset < 0 || ann.end_offset < 0) {
              ctx.reportError({
                code: 'NEGATIVE_OFFSET',
                message: `Annotation has negative offsets: [${ann.start_offset}, ${ann.end_offset}]`,
                extractorId: dto.extractor_id
              });
            }
          }
        }
      }
    }
  }

  private sanitizeObject(obj: any): void {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    
    // Strip __proto__ and constructor
    if (Object.prototype.hasOwnProperty.call(obj, '__proto__')) {
      delete obj['__proto__'];
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'constructor')) {
      delete obj['constructor'];
    }

    // Strip unprintable characters from string values
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        // Remove \x00-\x08\x0B\x0C\x0E-\x1F
        obj[key] = obj[key].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key]); // Recursion is bounded to object depth (which is small), NOT tree depth
      }
    }
  }
}
