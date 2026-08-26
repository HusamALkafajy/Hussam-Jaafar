import { BuilderContext, BuilderPass } from '../types';

export class Pass1Security implements BuilderPass {
  name = 'SecuritySanitization';

  execute(ctx: BuilderContext): void {
    const seenIds = new Set<string>();

    for (let i = 0; i < ctx.nodes.length; i++) {
      const node = ctx.nodes[i];

      // 1. Duplicate Source ID (if provided)
      if (node.block.sourceId) {
        if (seenIds.has(node.block.sourceId)) {
          ctx.reportError({
            code: 'DUPLICATE_SOURCE_ID',
            message: `Duplicate sourceId detected: ${node.block.sourceId}`
          });
        }
        seenIds.add(node.block.sourceId);
      }

      // 2. Text sanitization
      if (typeof node.block.text === 'string') {
        node.block.text = node.block.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      } else {
        node.block.text = ''; // Coerce to empty string if missing or invalid
      }

      // 3. Prototype Pollution and Invalid Object shapes in metadata
      if (node.block.metadata) {
        this.sanitizeObject(node.block.metadata);
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
