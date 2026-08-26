import { ValidationRule, ValidationContext } from '../types';

export const semanticRule: ValidationRule = {
  id: 'semantic-validation',
  description: 'Validates semantic content and metadata structures',
  validate: (ctx: ValidationContext) => {
    for (const node of ctx.nodes) {
      if (node.node_type === 'heading') {
        const level = node.content?.level;
        if (typeof level !== 'number' || level < 1 || level > 6) {
          ctx.reportIssue({
            code: 'INVALID_HEADING_LEVEL',
            message: `Heading node has invalid or missing level: ${level}`,
            severity: 'error',
            nodeId: node.id
          });
        }
      }

      if (['paragraph', 'heading', 'list_item', 'table_cell', 'quote'].includes(node.node_type)) {
        // Warning if purely textual nodes are empty
        if (!node.content?.text || (typeof node.content.text === 'string' && node.content.text.trim().length === 0)) {
          // If it doesn't have child nodes, it's truly empty
          const children = ctx.adjacencyList.get(node.id) || [];
          if (children.length === 0) {
            ctx.reportIssue({
              code: 'EMPTY_CONTENT',
              message: `Node of type ${node.node_type} has no text and no children`,
              severity: 'warning',
              nodeId: node.id
            });
          }
        }
      }
    }
  }
};
