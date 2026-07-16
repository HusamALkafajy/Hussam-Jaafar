import { ValidationRule, ValidationContext } from '../types';

const VALID_NODE_TYPES = new Set([
  'document', 'section', 'column', 'heading', 'paragraph', 'quote', 'code', 
  'list', 'list_item', 'table', 'table_row', 'table_cell', 'image', 'equation', 
  'video', 'audio', 'footnote', 'citation', 'callout', 'reference_list'
]);

export const schemaRule: ValidationRule = {
  id: 'schema-validation',
  description: 'Validates node schema, IDs, and valid node types',
  validate: (ctx: ValidationContext) => {
    const seenIds = new Set<string>();

    for (const node of ctx.nodes) {
      if (!node.id) {
        ctx.reportIssue({
          code: 'MISSING_ID',
          message: 'Node is missing an id',
          severity: 'error'
        });
        continue;
      }

      if (seenIds.has(node.id)) {
        ctx.reportIssue({
          code: 'DUPLICATE_ID',
          message: `Duplicate node id: ${node.id}`,
          severity: 'error',
          nodeId: node.id
        });
      }
      seenIds.add(node.id);

      if (!node.node_type) {
        ctx.reportIssue({
          code: 'MISSING_TYPE',
          message: `Node is missing node_type`,
          severity: 'error',
          nodeId: node.id
        });
      } else if (!VALID_NODE_TYPES.has(node.node_type)) {
        ctx.reportIssue({
          code: 'UNKNOWN_NODE_TYPE',
          message: `Unknown node type: ${node.node_type}`,
          severity: 'error',
          nodeId: node.id
        });
      }

      if (!node.lexo_rank || typeof node.lexo_rank !== 'string' || node.lexo_rank.length === 0) {
        ctx.reportIssue({
          code: 'INVALID_LEXO_RANK',
          message: `Node has invalid or missing lexo_rank`,
          severity: 'error',
          nodeId: node.id
        });
      }
    }
  }
};
