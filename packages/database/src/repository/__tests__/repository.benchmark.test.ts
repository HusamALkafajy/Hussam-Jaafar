import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentRepository, InsertNode } from '../document_repository';
import * as client from '../../client';

describe('DocumentRepository Benchmarks & Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const generateNodes = (count: number): InsertNode[] => {
    const nodes: InsertNode[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        id: `uuid-${i}`,
        fileId: 'file-1',
        versionId: 'v1',
        nodeType: 'paragraph',
        lexoRank: `rank-${i}`,
        content: { text: 'test' },
        metadata: {}
      });
    }
    return nodes;
  };

  const setupMockDb = (mockLatencyMs: number = 0) => {
    const insertMock = vi.fn().mockReturnThis();
    const valuesMock = vi.fn().mockReturnThis();
    const onConflictMock = vi.fn().mockImplementation(async () => {
      if (mockLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, mockLatencyMs));
      }
    });

    vi.spyOn(client.db, 'transaction').mockImplementation(async (callback: any) => {
      const mockTx = {
        insert: insertMock,
      };
      insertMock.mockReturnValue({ values: valuesMock });
      valuesMock.mockReturnValue({ onConflictDoUpdate: onConflictMock });
      await callback(mockTx);
    });

    return { onConflictMock };
  };

  it('should process 10,000 nodes safely with chunking', async () => {
    setupMockDb();
    const repo = new DocumentRepository({ chunkSize: 1000 });
    const nodes = generateNodes(10000);
    
    const result = await repo.persistNodes(nodes);
    
    expect(result.success).toBe(true);
    expect(result.diagnostics.inserted_rows).toBe(10000);
    // 10000 / 1000 = 10 transactions
    expect(client.db.transaction).toHaveBeenCalledTimes(10);
  });

  it('benchmark chunk size 500', async () => {
    setupMockDb(5); // 5ms per transaction DB latency
    const repo = new DocumentRepository({ chunkSize: 500 });
    const nodes = generateNodes(50000); // 50k nodes
    
    const startHeap = process.memoryUsage().heapUsed;
    const start = Date.now();
    await repo.persistNodes(nodes);
    const duration = Date.now() - start;
    const endHeap = process.memoryUsage().heapUsed;

    // 50000 / 500 = 100 chunks. 100 * 5ms = 500ms theoretical DB time.
    expect(client.db.transaction).toHaveBeenCalledTimes(100);
    console.log(`[Chunk 500] Duration: ${duration}ms, Peak Heap Diff: ${(endHeap - startHeap) / 1024 / 1024}MB`);
  });

  it('benchmark chunk size 1000', async () => {
    setupMockDb(5); // 5ms per transaction DB latency
    const repo = new DocumentRepository({ chunkSize: 1000 });
    const nodes = generateNodes(50000); 
    
    const startHeap = process.memoryUsage().heapUsed;
    const start = Date.now();
    await repo.persistNodes(nodes);
    const duration = Date.now() - start;
    const endHeap = process.memoryUsage().heapUsed;

    // 50000 / 1000 = 50 chunks. 50 * 5ms = 250ms theoretical DB time.
    expect(client.db.transaction).toHaveBeenCalledTimes(50);
    console.log(`[Chunk 1000] Duration: ${duration}ms, Peak Heap Diff: ${(endHeap - startHeap) / 1024 / 1024}MB`);
  });

  it('benchmark chunk size 2000', async () => {
    setupMockDb(5); // 5ms per transaction DB latency
    const repo = new DocumentRepository({ chunkSize: 2000 });
    const nodes = generateNodes(50000); 
    
    const startHeap = process.memoryUsage().heapUsed;
    const start = Date.now();
    await repo.persistNodes(nodes);
    const duration = Date.now() - start;
    const endHeap = process.memoryUsage().heapUsed;

    // 50000 / 2000 = 25 chunks. 25 * 5ms = 125ms theoretical DB time.
    expect(client.db.transaction).toHaveBeenCalledTimes(25);
    console.log(`[Chunk 2000] Duration: ${duration}ms, Peak Heap Diff: ${(endHeap - startHeap) / 1024 / 1024}MB`);
  });

  it('should rollback and preserve diagnostics if a chunk fails', async () => {
    const { onConflictMock } = setupMockDb();
    
    // Fail on the 3rd chunk
    let callCount = 0;
    onConflictMock.mockImplementation(async () => {
      callCount++;
      if (callCount === 3) throw new Error('Deadlock detected');
    });

    const repo = new DocumentRepository({ chunkSize: 1000 });
    const nodes = generateNodes(5000); // 5 chunks
    
    const result = await repo.persistNodes(nodes);
    
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Deadlock detected');
    
    // First 2 chunks succeeded before the 3rd failed
    expect(result.diagnostics.inserted_rows).toBe(2000);
    expect(client.db.transaction).toHaveBeenCalledTimes(3);
  });
});
