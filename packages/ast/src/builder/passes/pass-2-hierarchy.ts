import { BuilderContext, BuilderPass } from '../types';

export class Pass2Hierarchy implements BuilderPass {
  name = 'HierarchyResolution';

  execute(ctx: BuilderContext): void {
    // Stack holds the index of active parent nodes.
    // Index 0: document, 1: H1, 2: H2, ..., 6: H6
    const stack: { level: number; index: number }[] = [];

    const getLevel = (type: string): number => {
      if (type === 'document') return 0;
      if (type.startsWith('heading_')) return parseInt(type.split('_')[1], 10);
      return 99; // Leaves (paragraph, table, etc)
    };

    for (let i = 0; i < ctx.nodes.length; i++) {
      const node = ctx.nodes[i];
      const level = getLevel(node.block.type);

      // If it's a heading or document, pop stack until we find a strict parent (level < current_level)
      if (level <= 6) {
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
      }

      // Assign parent
      if (stack.length > 0) {
        // We set canonical_parent_id to the index for now as a temporary reference.
        // Pass 3 (Identity) will convert this index reference into a real UUID.
        // We temporarily store the parent index in _canonical_parent_id as a string.
        ctx.setCanonicalParentId(i, `INDEX:${stack[stack.length - 1].index}`);
      } else {
        ctx.setCanonicalParentId(i, null);
      }

      // If it's a structural container (document or heading), push to stack
      if (level <= 6) {
        stack.push({ level, index: i });
      }
    }
  }
}
