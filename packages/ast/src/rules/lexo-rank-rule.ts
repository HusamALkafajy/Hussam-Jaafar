import { ValidationRule, ValidationContext } from '../types';

export const lexoRankRule: ValidationRule = {
  id: 'lexorank-validation',
  description: 'Validates LexoRank uniqueness among siblings',
  validate: (ctx: ValidationContext) => {
    const parentRankSets = new Map<string | null, Set<string>>();

    for (const node of ctx.nodes) {
      if (!node.lexo_rank) continue;

      let rankSet = parentRankSets.get(node.parent_id);
      if (!rankSet) {
        rankSet = new Set<string>();
        parentRankSets.set(node.parent_id, rankSet);
      }

      if (rankSet.has(node.lexo_rank)) {
        ctx.reportIssue({
          code: 'DUPLICATE_LEXO_RANK',
          message: `Duplicate lexo_rank '${node.lexo_rank}' under parent '${node.parent_id}'`,
          severity: 'error',
          nodeId: node.id
        });
      }
      rankSet.add(node.lexo_rank);
    }
  }
};
