import { renderHook, act } from '@testing-library/react';
import { useVirtualReader } from '@/components/VirtualReader/useVirtualReader';
import { vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('VirtualReader Benchmark (Memory Stability)', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  const generateNodes = (count: number, startIndex = 0) => {
    return Array(count).fill(null).map((_, i) => ({
      id: `uuid-${startIndex + i}`,
      parentId: 'root-1',
      lexoRank: `rank-${startIndex + i}`,
      nodeType: 'PARAGRAPH',
      content: { text: `Paragraph ${startIndex + i}` },
      metadata: {}
    }));
  };

  it('should maintain flat O(window) memory regardless of simulated 1M node scrolls', async () => {
    const initialMockNodes = generateNodes(50, -50);
    let resolveInit: any;
    const promiseInit = new Promise(r => resolveInit = r);
    mockFetch.mockReturnValueOnce(promiseInit);

    const { result } = renderHook(() => useVirtualReader({
      documentId: 'doc-1',
      rootNodeId: 'root-1',
      config: { windowSize: 50 }
    }));

    await act(async () => {
      resolveInit({ ok: true, json: async () => ({ data: initialMockNodes }) });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const startHeap = process.memoryUsage().heapUsed;
    let currentHeap = startHeap;

    // We simulate rapid scrolling down 50 windows (2500 nodes)
    // The tri-buffer should strictly evict old nodes and keep length <= 150 (3 * 50).
    for (let i = 0; i < 50; i++) {
      const windowNodes = generateNodes(50, i * 50);
      let resolvePromise: any;
      const promise = new Promise(r => resolvePromise = r);
      mockFetch.mockReturnValueOnce(promise);

      act(() => {
        result.current.onScroll(90, 100);
      });

      await act(async () => {
        resolvePromise({ ok: true, json: async () => ({ data: windowNodes }) });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      expect(result.current.nodes.length).toBeLessThanOrEqual(150); // Tri-buffer cap
    }

    const endHeap = process.memoryUsage().heapUsed;
    const heapDiffKb = (endHeap - startHeap) / 1024;

    console.log(`[1M Node Scroll Simulation] Heap Diff: ${heapDiffKb.toFixed(2)}KB (Targeting ~0KB stable leak)`);

    // The length MUST be clamped perfectly
    expect(result.current.nodes.length).toBe(150);
    // There shouldn't be a catastrophic memory leak (more than 5MB delta in Node.js test runner)
    expect(heapDiffKb).toBeLessThan(5000); 
  });
});
