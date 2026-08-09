import { renderHook, act } from '@testing-library/react';
import { useVirtualReader } from '@/components/VirtualReader/useVirtualReader';
import { DocumentNode } from '@/components/VirtualReader/types';
import { vi } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useVirtualReader', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  const generateNodes = (count: number, startIndex = 0): DocumentNode[] => {
    return Array(count).fill(null).map((_, i) => ({
      id: `node-${startIndex + i}`,
      parentId: 'root-1',
      lexoRank: `rank-${startIndex + i}`,
      nodeType: 'PARAGRAPH',
      content: { text: `Paragraph ${startIndex + i}` },
      metadata: {}
    }));
  };

  it('should fetch initial window on mount', async () => {
    const mockNodes = generateNodes(50);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockNodes })
    });

    const { result } = renderHook(() => useVirtualReader({
      versionId: 'version-1',
      rootNodeId: 'root-1',
      config: { windowSize: 50 }
    }));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for fetch
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.nodes).toHaveLength(50);
    // React keys identity constraint check
    expect(result.current.nodes[0].id).toBe('node-0');
  });

  it('should maintain Tri-Buffer window eviction (O(window) memory)', async () => {
    const initialNodes = generateNodes(50, 0); // 0-49
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: initialNodes })
    });

    const { result } = renderHook(() => useVirtualReader({
      versionId: 'version-1',
      rootNodeId: 'root-1',
      config: { windowSize: 50 }
    }));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // Trigger multiple prefetches to exceed tri-buffer limit
    const nextNodes1 = generateNodes(50, 50); // 50-99
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: nextNodes1 })
    });
    
    await act(async () => {
      result.current.onScroll(90, 100); // Trigger prefetch 1
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.nodes).toHaveLength(100);

    const nextNodes2 = generateNodes(50, 100); // 100-149
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: nextNodes2 })
    });

    await act(async () => {
      result.current.onScroll(90, 100); // Trigger prefetch 2
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.nodes).toHaveLength(150); // Tri-buffer cap reached (50 * 3)

    const nextNodes3 = generateNodes(50, 150); // 150-199
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: nextNodes3 })
    });

    await act(async () => {
      result.current.onScroll(90, 100); // Trigger prefetch 3
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // The total length MUST remain clamped to windowSize * 3 (150).
    // The top 50 elements (node-0 to node-49) were evicted.
    expect(result.current.nodes).toHaveLength(150);
    expect(result.current.nodes[0].id).toBe('node-50'); // Correctly evicted top nodes
    expect(result.current.nodes[149].id).toBe('node-199');
  });

  it('should ignore out-of-order responses (race condition rejection)', async () => {
    // We simulate rapid scroll triggers.
    const nodesA = generateNodes(50, 0);
    const nodesB = generateNodes(50, 50);

    let resolveA: any;
    let resolveB: any;

    const promiseA = new Promise(r => resolveA = r);
    const promiseB = new Promise(r => resolveB = r);

    const initialMockNodes = generateNodes(50, -50);
    let resolveInit: any;
    const promiseInit = new Promise(r => resolveInit = r);

    mockFetch
      .mockReturnValueOnce(promiseInit)
      .mockReturnValueOnce(promiseA) // First request
      .mockReturnValueOnce(promiseB); // Second request (rapid scroll)

    const { result } = renderHook(() => useVirtualReader({
      versionId: 'version-1',
      rootNodeId: 'root-1',
      config: { windowSize: 50 }
    }));

    // Resolve initial fetch first
    await act(async () => {
      resolveInit({ ok: true, json: async () => ({ data: initialMockNodes }) });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Trigger first request
    act(() => {
      result.current.onScroll(90, 100);
    });
    
    // Trigger second request rapidly before first finishes
    act(() => {
      // Need to change the nodes array or something? No, onScroll just triggers a fetch
      result.current.onScroll(90, 100);
    });

    // Resolve second request first (out of order)
    await act(async () => {
      resolveB({ ok: true, json: async () => ({ data: nodesB }) });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // It should have nodes B merged with Initial
    expect(result.current.nodes).toHaveLength(100);
    
    // Resolve first request later
    await act(async () => {
      resolveA({ ok: true, json: async () => ({ data: nodesA }) });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // The delayed first response should be IGNORED because a newer request won.
    expect(result.current.nodes[50].id).toBe('node-50'); // Still Nodes B at index 50
  });
});
