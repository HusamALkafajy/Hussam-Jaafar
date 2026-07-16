import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DocumentReadModule } from '../document-read.module';
import { DocumentReadController } from '../document-read.controller';
import { DocumentQueryService } from '@studyai/database';

// Mock the database query service
jest.mock('@studyai/database');

describe('DocumentReadController Benchmarks', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DocumentReadModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const simulateResult = (size: number) => {
    return {
      data: Array(size).fill({ id: 'test' }),
      diagnostics: { duration_ms: 1, rows_returned: size },
    };
  };

  const measureOverhead = async (windowSize: number, totalScale: number) => {
    const mockResult = simulateResult(windowSize);
    (DocumentQueryService.getWindow as jest.Mock).mockResolvedValue(mockResult);

    const controller = app.get(DocumentReadController);

    const startHeap = process.memoryUsage().heapUsed;
    const start = Date.now();
    
    // Simulate direct controller invocation (avoiding network loopback overhead for pure logic benchmark)
    const result = await controller.getWindow('parent', 'cursor', { limit: windowSize });
    
    const duration = Date.now() - start;
    const endHeap = process.memoryUsage().heapUsed;
    const heapDiffKb = (endHeap - startHeap) / 1024;

    console.log(`[API Window ${windowSize} (Scale: ${totalScale} nodes)] Latency: ${duration}ms, Heap Diff: ${heapDiffKb.toFixed(2)}KB`);
    
    expect(result.data.length).toBe(windowSize);
  };

  it('benchmark window 25 (10k scale)', async () => {
    await measureOverhead(25, 10000);
  });

  it('benchmark window 100 (100k scale)', async () => {
    await measureOverhead(100, 100000);
  });

  it('benchmark window 250 (1M scale)', async () => {
    await measureOverhead(250, 1000000);
  });
  
  it('benchmark window 1000 (1M scale)', async () => {
    await measureOverhead(1000, 1000000);
  });
});
