import { BuilderContext, BuilderPass } from '../types';

export class Pass4LexoRank implements BuilderPass {
  name = 'LexoRankOrdering';

  execute(ctx: BuilderContext): void {
    const siblingCounters = new Map<string | null, number>();

    for (let i = 0; i < ctx.dtos.length; i++) {
      const dto = ctx.dtos[i];
      const parentId = dto._canonical_parent_id || null;
      
      const currentCount = siblingCounters.get(parentId) || 0;
      const rank = this.generateRank(currentCount);
      ctx.setLexoRank(i, rank);
      
      siblingCounters.set(parentId, currentCount + 1);
    }
  }

  // Generates a simple lexicographically sortable string: '000', '001', ... 'zzz'
  // To support large sibling sets (up to ~46000 with 3 base-36 digits)
  // For 1M siblings we can just use 5 digits which supports 60M elements.
  private generateRank(index: number): string {
    // Base 36, padded to 5 characters (supports 36^5 = 60,466,176 siblings)
    return index.toString(36).padStart(5, '0');
  }
}
