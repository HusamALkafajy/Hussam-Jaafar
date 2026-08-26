import { 
  ASTNode, 
  ValidationResult, 
  ValidationContext, 
  ValidationIssue 
} from './types';
import { defaultRegistry } from './rule-registry';
import { schemaRule, graphRule, lexoRankRule, semanticRule, extensionsRule } from './rules';

// Register core rules
defaultRegistry.register(schemaRule);
defaultRegistry.register(graphRule);
defaultRegistry.register(lexoRankRule);
defaultRegistry.register(semanticRule);
defaultRegistry.register(extensionsRule);

export class ASTValidator {
  /**
   * Validates a complete AST in memory.
   * Throws no exceptions; returns a deterministic report.
   */
  static validate(nodes: ASTNode[]): ValidationResult {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;

    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // Pre-allocate core indices for O(1) lookups in rules
    const nodeMap = new Map<string, ASTNode>();
    const adjacencyList = new Map<string | null, string[]>();
    
    // O(N) indexing phase
    for (const node of nodes) {
      if (node.id) {
        nodeMap.set(node.id, node);
      }
      
      // Build adjacency list for fast graph traversal
      let children = adjacencyList.get(node.parent_id);
      if (!children) {
        children = [];
        adjacencyList.set(node.parent_id, children);
      }
      if (node.id) {
        children.push(node.id);
      }
    }

    const context: ValidationContext = {
      nodes,
      nodeMap,
      adjacencyList,
      rankSetByParent: new Map(),
      errors,
      warnings,
      reportIssue: (issue: ValidationIssue) => {
        if (issue.severity === 'error') {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      },
      cyclesDetected: 0,
      maxDepth: 0,
      leafCount: 0,
      orphanCount: 0,
      relationshipCount: 0,
      annotationCount: 0,
      assetCount: 0
    };

    // Execute all registered rules (Each rule is O(N))
    const rules = defaultRegistry.getRules();
    for (const rule of rules) {
      try {
        rule.validate(context);
      } catch (err: any) {
        // Engine must be pure and never throw.
        context.reportIssue({
          code: 'RULE_EXECUTION_ERROR',
          message: `Rule ${rule.id} threw an exception: ${err.message}`,
          severity: 'error'
        });
      }
    }

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        nodeCount: nodes.length,
        relationshipCount: context.relationshipCount,
        assetCount: context.assetCount,
        annotationCount: context.annotationCount,
        maxDepth: context.maxDepth,
        averageBranchingFactor: nodes.length > 0 ? (nodes.length - 1) / (nodes.length - context.leafCount || 1) : 0,
        rootCount: (adjacencyList.get(null) || []).length,
        leafCount: context.leafCount,
        cycleCount: context.cyclesDetected,
        orphanCount: context.orphanCount,
        duplicateCount: 0, // ID duplicates are tracked via schema rule implicitly
        validationDurationMs: Number(endTime - startTime) / 1_000_000,
        estimatedMemoryUsageBytes: Math.max(0, endMemory - startMemory)
      }
    };
  }
}
