import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentQueryService } from '../query_service';
import * as client from '../../client';
import { NodeResult } from '../types';

describe('DocumentQueryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const generateNodes = (count: number, parentId: string | null = null): NodeResult[] => {
    const nodes: NodeResult[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        id: `node-${i}`,
        parentId,
        lexoRank: `rank-${String(i).padStart(5, '0')}`,
        nodeType: 'PARAGRAPH',
        content: {},
        metadata: {}
      });
    }
    return nodes;
  };

  it('should fetch a single node in O(1)', async () => {
    const mockNode = generateNodes(1)[0];
    
    // Mock db.select().from().where().limit() chain
    const limitMock = vi.fn().mockResolvedValue([mockNode]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.spyOn(client.db, 'select').mockReturnValue({ from: fromMock } as any);

    const result = await DocumentQueryService.getNode('mock-version-id', 'node-0');
    
    expect(result.data).toEqual(mockNode);
    expect(result.diagnostics.rows_returned).toBe(1);
    expect(result.diagnostics.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('should fetch children with cursor windowing in O(window)', async () => {
    const mockNodes = generateNodes(100, 'parent-1');
    
    const limitMock = vi.fn().mockResolvedValue(mockNodes);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.spyOn(client.db, 'select').mockReturnValue({ from: fromMock } as any);

    const result = await DocumentQueryService.getChildren('mock-version-id', 'parent-1', 100, 'rank-00000');
    
    expect(result.data.length).toBe(100);
    expect(result.diagnostics.window_size).toBe(100);
    expect(result.diagnostics.cursor_position).toBe('rank-00000');
  });

  it('should execute raw SQL CTE for ancestors', async () => {
    const mockNodes = generateNodes(3);
    vi.spyOn(client.db, 'execute').mockResolvedValue(mockNodes as any);

    const result = await DocumentQueryService.getAncestors('mock-version-id', 'node-3');
    
    expect(result.data.length).toBe(3);
    expect(client.db.execute).toHaveBeenCalled();
  });
});
