import { db } from '../client';
import { DatabaseExecutor } from '../types';
import { 
  documentNodes, 
  nodeRelationships, 
  annotations, 
  bookmarks, 
  documentAssets 
} from '../schema/document_engine';
import { RepositoryDiagnostics, PersistenceResult, DocumentRepositoryConfig } from './types';
import { InferInsertModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export type InsertNode = InferInsertModel<typeof documentNodes>;
export type InsertRelationship = InferInsertModel<typeof nodeRelationships>;
export type InsertAnnotation = InferInsertModel<typeof annotations>;
export type InsertBookmark = InferInsertModel<typeof bookmarks>;
export type InsertAsset = InferInsertModel<typeof documentAssets>;

export class DocumentRepository {
  private chunkSize: number;

  constructor(config?: DocumentRepositoryConfig) {
    this.chunkSize = config?.chunkSize || 1000;
  }

  /**
   * Helper to partition an array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Creates an empty diagnostics object
   */
  private createDiagnostics(): RepositoryDiagnostics {
    return {
      inserted_rows: 0,
      updated_rows: 0,
      skipped_rows: 0,
      retries: 0,
      constraint_violations: 0,
      chunk_duration_ms: 0,
      commit_duration_ms: 0,
      rollback_duration_ms: 0,
      deadlocks: 0
    };
  }

  /**
   * Persists Canonical Nodes idempotently using chunked transactions.
   */
  async persistNodes(nodes: InsertNode[], executor: DatabaseExecutor = db): Promise<PersistenceResult> {
    const diagnostics = this.createDiagnostics();
    const startTime = Date.now();
    const chunks = this.chunkArray(nodes, this.chunkSize);

    try {
      for (const chunk of chunks) {
        const chunkStart = Date.now();
        
        const executeChunk = async (txClient: DatabaseExecutor) => {
          await txClient.insert(documentNodes)
            .values(chunk)
            .onConflictDoUpdate({
              target: documentNodes.id,
              set: {
                content: sql`EXCLUDED.content`,
                metadata: sql`EXCLUDED.metadata`,
                lexoRank: sql`EXCLUDED.lexo_rank`,
                updatedAt: sql`now()`
              }
            });
        };

        if (executor === db) {
          // Default behavior: separate transaction per chunk
          await db.transaction(executeChunk, { isolationLevel: 'read committed' });
        } else {
          // Transaction provided: execute in the outer transaction context
          await executeChunk(executor);
        }
        
        diagnostics.chunk_duration_ms += (Date.now() - chunkStart);
        // We consider all records either inserted or updated since it's UPSERT
        diagnostics.inserted_rows += chunk.length;
      }

      diagnostics.commit_duration_ms = Date.now() - startTime;
      return { success: true, diagnostics };
    } catch (error: any) {
      diagnostics.rollback_duration_ms = Date.now() - startTime;
      return { success: false, diagnostics, error };
    }
  }

  /**
   * Persists Resolved Relationships idempotently.
   */
  async persistRelationships(relationships: InsertRelationship[], executor: DatabaseExecutor = db): Promise<PersistenceResult> {
    const diagnostics = this.createDiagnostics();
    const startTime = Date.now();
    const chunks = this.chunkArray(relationships, this.chunkSize);

    try {
      for (const chunk of chunks) {
        const chunkStart = Date.now();
        
        const executeChunk = async (txClient: DatabaseExecutor) => {
          await txClient.insert(nodeRelationships)
            .values(chunk)
            .onConflictDoUpdate({
              target: nodeRelationships.id,
              set: {
                sourceNodeId: sql`EXCLUDED.source_node_id`,
                targetNodeId: sql`EXCLUDED.target_node_id`,
                relationshipType: sql`EXCLUDED.relationship_type`
              }
            });
        };

        if (executor === db) {
          await db.transaction(executeChunk, { isolationLevel: 'read committed' });
        } else {
          await executeChunk(executor);
        }
        
        diagnostics.chunk_duration_ms += (Date.now() - chunkStart);
        diagnostics.inserted_rows += chunk.length;
      }

      diagnostics.commit_duration_ms = Date.now() - startTime;
      return { success: true, diagnostics };
    } catch (error: any) {
      diagnostics.rollback_duration_ms = Date.now() - startTime;
      return { success: false, diagnostics, error };
    }
  }
}
