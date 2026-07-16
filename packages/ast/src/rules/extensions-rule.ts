import { ValidationRule, ValidationContext } from '../types';

const VALID_RELATIONSHIP_TYPES = new Set([
  'citation_target', 'footnote_target', 'internal_link'
]);

export const extensionsRule: ValidationRule = {
  id: 'extensions-validation',
  description: 'Validates relationships, annotations, and assets',
  validate: (ctx: ValidationContext) => {
    for (const node of ctx.nodes) {
      // Validate relationships
      if (node.relationships) {
        const seenTargets = new Set<string>();
        for (const rel of node.relationships) {
          ctx.relationshipCount++;

          if (!rel.target_id) {
            ctx.reportIssue({
              code: 'MISSING_RELATIONSHIP_TARGET',
              message: `Relationship missing target_id`,
              severity: 'error',
              nodeId: node.id
            });
          } else if (!ctx.nodeMap.has(rel.target_id)) {
            ctx.reportIssue({
              code: 'BROKEN_RELATIONSHIP',
              message: `Relationship points to non-existent node: ${rel.target_id}`,
              severity: 'error',
              nodeId: node.id
            });
          }

          if (rel.target_id === node.id) {
            ctx.reportIssue({
              code: 'SELF_RELATIONSHIP_CYCLE',
              message: `Node has a relationship pointing to itself`,
              severity: 'error',
              nodeId: node.id
            });
          }

          if (seenTargets.has(rel.target_id)) {
            ctx.reportIssue({
              code: 'DUPLICATE_REFERENCE',
              message: `Duplicate relationship to target: ${rel.target_id}`,
              severity: 'warning',
              nodeId: node.id
            });
          }
          if (rel.target_id) seenTargets.add(rel.target_id);

          if (!VALID_RELATIONSHIP_TYPES.has(rel.type)) {
            ctx.reportIssue({
              code: 'INVALID_RELATIONSHIP_TYPE',
              message: `Unknown relationship type: ${rel.type}`,
              severity: 'error',
              nodeId: node.id
            });
          }
        }
      }

      // Validate annotations
      if (node.annotations) {
        for (const ann of node.annotations) {
          ctx.annotationCount++;

          if (typeof ann.start_offset !== 'number' || typeof ann.end_offset !== 'number') {
            ctx.reportIssue({
              code: 'MALFORMED_ANNOTATION',
              message: `Annotation missing start or end offset`,
              severity: 'error',
              nodeId: node.id
            });
          } else if (ann.start_offset < 0 || ann.start_offset >= ann.end_offset) {
            ctx.reportIssue({
              code: 'INVALID_ANNOTATION_OFFSETS',
              message: `Annotation has invalid offsets: [${ann.start_offset}, ${ann.end_offset})`,
              severity: 'error',
              nodeId: node.id
            });
          }
        }
      }

      // Validate assets
      if (node.assets) {
        for (const asset of node.assets) {
          ctx.assetCount++;

          if (!asset.id) {
            ctx.reportIssue({
              code: 'INVALID_ASSET',
              message: `Asset missing id`,
              severity: 'error',
              nodeId: node.id
            });
          }
          
          if (!['image', 'pdf_page_render', 'video', 'audio'].includes(asset.asset_type)) {
             ctx.reportIssue({
              code: 'INVALID_ASSET_TYPE',
              message: `Unknown asset type: ${asset.asset_type}`,
              severity: 'error',
              nodeId: node.id
            });
          }
        }
      }
    }
  }
};
