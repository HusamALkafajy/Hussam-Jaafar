import { db } from '../client';
import { documentNodes } from '../schema/document_engine';
import { eq, asc, desc, and, gt, lt, sql, isNull } from 'drizzle-orm';
import { QueryResult, NodeResult } from './types';

export class DocumentQueryService {
  /**
   * Node lookup -> O(1)
   */
  static async getNode(versionId: string, id: string): Promise<QueryResult<NodeResult | null>> {
    const start = Date.now();
    const result = await db.select().from(documentNodes).where(and(eq(documentNodes.versionId, versionId), eq(documentNodes.id, id))).limit(1);
    const duration = Date.now() - start;
    
    return {
      data: result.length > 0 ? result[0] : null,
      diagnostics: {
        duration_ms: duration,
        db_latency_ms: duration,
        rows_returned: result.length
      }
    };
  }

  /**
   * Children lookup -> O(window)
   */
  static async getChildren(versionId: string, parentId: string | null, limit: number, cursor?: string): Promise<QueryResult<NodeResult[]>> {
    const start = Date.now();
    
    const conditions = [eq(documentNodes.versionId, versionId)];
    if (parentId === null) {
      conditions.push(isNull(documentNodes.parentId));
    } else {
      conditions.push(eq(documentNodes.parentId, parentId));
    }
    
    if (cursor) {
      conditions.push(gt(documentNodes.lexoRank, cursor));
    }

    const result = await db.select()
      .from(documentNodes)
      .where(and(...conditions))
      .orderBy(asc(documentNodes.lexoRank))
      .limit(limit);

    const duration = Date.now() - start;

    return {
      data: result,
      diagnostics: {
        duration_ms: duration,
        db_latency_ms: duration,
        rows_returned: result.length,
        cursor_position: cursor,
        window_size: limit
      }
    };
  }

  /**
   * Ancestor lookup -> Recursive CTE
   */
  static async getAncestors(versionId: string, nodeId: string): Promise<QueryResult<NodeResult[]>> {
    const start = Date.now();
    
    // Using Drizzle's execute with raw SQL for recursive CTE
    const query = sql`
      WITH RECURSIVE ancestors AS (
        SELECT * FROM document_nodes WHERE id = ${nodeId} AND version_id = ${versionId}
        UNION ALL
        SELECT d.* FROM document_nodes d
        INNER JOIN ancestors a ON d.id = a.parent_id AND d.version_id = ${versionId}
      )
      SELECT * FROM ancestors WHERE id != ${nodeId};
    `;
    
    const result = await db.execute(query);
    const duration = Date.now() - start;

    return {
      data: result as any,
      diagnostics: {
        duration_ms: duration,
        db_latency_ms: duration,
        rows_returned: result.length
      }
    };
  }

  /**
   * Descendant lookup -> Recursive CTE with depth limit
   */
  static async getDescendants(versionId: string, nodeId: string, depthLimit: number = 10): Promise<QueryResult<NodeResult[]>> {
    const start = Date.now();
    
    const query = sql`
      WITH RECURSIVE descendants AS (
        SELECT *, 1 as depth FROM document_nodes WHERE id = ${nodeId} AND version_id = ${versionId}
        UNION ALL
        SELECT d.*, a.depth + 1 FROM document_nodes d
        INNER JOIN descendants a ON d.parent_id = a.id AND d.version_id = ${versionId}
        WHERE a.depth < ${depthLimit}
      )
      SELECT * FROM descendants WHERE id != ${nodeId};
    `;
    
    const result = await db.execute(query);
    const duration = Date.now() - start;

    return {
      data: result as any,
      diagnostics: {
        duration_ms: duration,
        db_latency_ms: duration,
        rows_returned: result.length
      }
    };
  }

  /**
   * Window generation -> Forward cursor pagination among siblings
   */
  static async getWindow(versionId: string, parentId: string | null, cursor: string, windowSize: number): Promise<QueryResult<NodeResult[]>> {
    return this.getChildren(versionId, parentId, windowSize, cursor);
  }

  /**
   * Context expansion -> Siblings before and after
   */
  static async expandContext(versionId: string, nodeId: string, before: number, after: number): Promise<QueryResult<NodeResult[]>> {
    const start = Date.now();
    
    // 1. Get the target node to find its parent and lexoRank
    const targetNodeResult = await this.getNode(versionId, nodeId);
    if (!targetNodeResult.data) {
       return { data: [], diagnostics: { duration_ms: 0, rows_returned: 0 } };
    }
    const target = targetNodeResult.data;
    
    // 2. Fetch 'before' siblings (lexoRank < target.lexoRank)
    const beforeConditions = target.parentId === null 
      ? [eq(documentNodes.versionId, versionId), isNull(documentNodes.parentId), lt(documentNodes.lexoRank, target.lexoRank)]
      : [eq(documentNodes.versionId, versionId), eq(documentNodes.parentId, target.parentId), lt(documentNodes.lexoRank, target.lexoRank)];

    const beforeResult = await db.select()
      .from(documentNodes)
      .where(and(...beforeConditions))
      .orderBy(desc(documentNodes.lexoRank))
      .limit(before);
      
    // 3. Fetch 'after' siblings (lexoRank > target.lexoRank)
    const afterConditions = target.parentId === null 
      ? [eq(documentNodes.versionId, versionId), isNull(documentNodes.parentId), gt(documentNodes.lexoRank, target.lexoRank)]
      : [eq(documentNodes.versionId, versionId), eq(documentNodes.parentId, target.parentId), gt(documentNodes.lexoRank, target.lexoRank)];

    const afterResult = await db.select()
      .from(documentNodes)
      .where(and(...afterConditions))
      .orderBy(asc(documentNodes.lexoRank))
      .limit(after);

    // Reconstruct ordered array: [ ...before (reversed), target, ...after ]
    const data = [...beforeResult.reverse(), target, ...afterResult];
    
    const duration = Date.now() - start;
    return {
      data,
      diagnostics: {
        duration_ms: duration,
        db_latency_ms: duration,
        rows_returned: data.length
      }
    };
  }

  /**
   * Heading Tree lookup -> Filters by HEADING nodeType
   */
  static async getHeadingTree(versionId: string): Promise<QueryResult<NodeResult[]>> {
    const start = Date.now();
    
    const result = await db.select()
      .from(documentNodes)
      .where(and(
        eq(documentNodes.versionId, versionId),
        eq(documentNodes.nodeType, 'heading')
      ))
      .orderBy(asc(documentNodes.lexoRank));
      
    const duration = Date.now() - start;
    
    return {
      data: result,
      diagnostics: {
        duration_ms: duration,
        db_latency_ms: duration,
        rows_returned: result.length
      }
    };
  }
}
