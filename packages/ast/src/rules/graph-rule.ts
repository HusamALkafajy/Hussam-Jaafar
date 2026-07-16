import { ValidationRule, ValidationContext } from '../types';

export const graphRule: ValidationRule = {
  id: 'graph-validation',
  description: 'Validates tree topology, checks for cycles and roots iteratively',
  validate: (ctx: ValidationContext) => {
    let rootCount = 0;
    
    // Check parent existence and count roots
    for (const node of ctx.nodes) {
      if (node.parent_id === null) {
        rootCount++;
      } else {
        if (!ctx.nodeMap.has(node.parent_id)) {
          ctx.reportIssue({
            code: 'ORPHAN_NODE',
            message: `Node references non-existent parent_id: ${node.parent_id}`,
            severity: 'error',
            nodeId: node.id
          });
          ctx.orphanCount++;
        }
      }
    }

    if (rootCount === 0) {
      ctx.reportIssue({
        code: 'ZERO_ROOTS',
        message: 'No root node found in the document.',
        severity: 'error'
      });
    } else if (rootCount > 1) {
      ctx.reportIssue({
        code: 'MULTI_ROOT',
        message: `Multiple roots found (${rootCount}). Single root policy violated.`,
        severity: 'error'
      });
    }

    // Cycle detection using Kahn's algorithm (iterative topological sort)
    // Works well since we have a map of parent -> children
    // In-degree array
    const inDegree = new Map<string, number>();
    for (const node of ctx.nodes) {
      inDegree.set(node.id, 0);
    }

    for (const [parentId, children] of ctx.adjacencyList.entries()) {
      if (parentId !== null) {
        for (const childId of children) {
          inDegree.set(childId, (inDegree.get(childId) || 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    let processedCount = 0;
    // For depth calculation
    const depthMap = new Map<string, number>();
    for (const id of queue) {
      depthMap.set(id, 1);
    }

    let maxDepth = 0;
    let leafCount = 0;

    let head = 0;
    while (head < queue.length) {
      const currentId = queue[head++];
      processedCount++;

      const currentDepth = depthMap.get(currentId) || 1;
      maxDepth = Math.max(maxDepth, currentDepth);

      const children = ctx.adjacencyList.get(currentId) || [];
      if (children.length === 0) {
        leafCount++;
      } else {
        for (const childId of children) {
          depthMap.set(childId, currentDepth + 1);
          const deg = (inDegree.get(childId) || 0) - 1;
          inDegree.set(childId, deg);
          if (deg === 0) {
            queue.push(childId);
          }
        }
      }
    }

    if (processedCount !== ctx.nodes.length) {
      // Cycles exist! processedCount is less than total nodes
      const cycleNodes = ctx.nodes.length - processedCount;
      ctx.cyclesDetected = cycleNodes;
      ctx.reportIssue({
        code: 'CIRCULAR_HIERARCHY',
        message: `Detected ${cycleNodes} nodes participating in circular hierarchies (cycles).`,
        severity: 'error'
      });
    }

    ctx.maxDepth = maxDepth;
    ctx.leafCount = leafCount;
  }
};
