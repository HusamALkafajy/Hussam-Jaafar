import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentQueryService } from '../query_service';
import * as client from '../../client';
import { NodeResult } from '../types';

describe('DocumentQueryService Benchmarks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const generateNodes = (count: number): NodeResult[] => {
    const nodes: NodeResult[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        id: `node-${i}`,
        parentId: 'parent-1',
        lexoRank: `rank-${String(i).padStart(5, '0')}`,
        nodeType: 'PARAGRAPH',
        content: {},
        metadata: {}
      });
    }
    return nodes;
  };

  const simulateDbQuery = (nodes: NodeResult[]) => {
    const limitMock = vi.fn().mockResolvedValue(nodes);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.spyOn(client.db, 'select').mockReturnValue({ from: fromMock } as any);
  };

  const runWindowBenchmark = async (windowSize: number, totalMockNodes: number) => {
    const mockNodes = generateNodes(windowSize);
    simulateDbQuery(mockNodes);

    const startHeap = process.memoryUsage().heapUsed;
    const result = await DocumentQueryService.getWindow('mock-version-id', 'parent-1', 'rank-00000', windowSize);
    const endHeap = process.memoryUsage().heapUsed;
    
    // Convert to KB for easier reading
    const heapDiffKb = (endHeap - startHeap) / 1024;

    console.log(`[Window ${windowSize} out of ${totalMockNodes} Nodes] Latency: ${result.diagnostics.duration_ms}ms, Heap Diff: ${heapDiffKb.toFixed(2)}KB`);
    
    expect(result.data.length).toBe(windowSize);
    expect(result.diagnostics.window_size).toBe(windowSize);
  };

  it('benchmark window 25 (10k scale simulation)', async () => {
    await runWindowBenchmark(25, 10000);
  });

  it('benchmark window 50 (100k scale simulation)', async () => {
    await runWindowBenchmark(50, 100000);
  });

  it('benchmark window 100 (1M scale simulation)', async () => {
    await runWindowBenchmark(100, 1000000);
  });

  it('benchmark window 250 (1M scale simulation)', async () => {
    await runWindowBenchmark(250, 1000000);
  });
});
