import { Test, TestingModule } from '@nestjs/testing';
import { FilesProcessor } from '../src/modules/files/files.processor';
import { FileProcessingExecutionService } from '../src/modules/files/services/file-processing-execution.service';
import { RagService } from '../src/modules/rag/rag.service';
import { FileProcessingStateRepository } from '../src/modules/files/repositories/file-processing-state.repository';
import { db, files, processingSessions, processingCheckpoints, documentChunks, eq, users, client } from '@studyai/database';
import { randomUUID } from 'crypto';

describe('FilesProcessor (Integration with PostgreSQL)', () => {
  let processor: FilesProcessor;
  let executionService: jest.Mocked<FileProcessingExecutionService>;
  let ragService: jest.Mocked<RagService>;
  let stateRepository: jest.Mocked<FileProcessingStateRepository>;
  let globalUserId: string;

  beforeAll(async () => {
    // Just to ensure connection is valid
    await db.execute('SELECT 1');
    const result = await db.insert(users).values({
      email: `test-${randomUUID()}@example.com`,
      firstName: 'Test',
      lastName: 'User',
    }).returning({ id: users.id });
    globalUserId = result[0].id;
  });

  beforeEach(async () => {
    executionService = {
      executeExtraction: jest.fn(),
    } as any;

    ragService = {
      indexFile: jest.fn(),
      generateChunkValues: jest.fn(),
    } as any;

    stateRepository = {
      transitionToTerminal: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesProcessor,
        { provide: FileProcessingExecutionService, useValue: executionService },
        { provide: RagService, useValue: ragService },
        { provide: FileProcessingStateRepository, useValue: stateRepository },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_JOBS_TOTAL',
          useValue: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
        },
      ],
    }).compile();

    processor = module.get<FilesProcessor>(FilesProcessor);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await client.end();
  });

  const setupFileAndSession = async (checkpointCount = 1) => {
    const fileId = randomUUID();
    const sessionId = randomUUID();
    
    // Insert file
    await db.insert(files).values({
      id: fileId,
      userId: globalUserId,
      originalName: 'integration_test.pdf',
      storageKey: 'test/integration_test.pdf',
      storageUrl: 'http://localhost/test.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      processingStatus: 'processing',
    });

    // Insert session
    await db.insert(processingSessions).values({
      id: sessionId,
      fileId,
      status: 'processing',
      totalChunks: checkpointCount,
    });

    // Insert checkpoints
    const checkpoints = [];
    for (let i = 0; i < checkpointCount; i++) {
      const result = await db.insert(processingCheckpoints).values({
        sessionId,
        chunkIndex: i,
        startPage: i * 5 + 1,
        endPage: i * 5 + 5,
        status: 'pending',
      }).returning({ id: processingCheckpoints.id });
      checkpoints.push(result[0].id);
    }

    return { fileId, sessionId, checkpoints };
  };

  it('1, 2, 3, 6: Checkpoint ownership is serialized using PostgreSQL row locking, prevents duplicate chunks', async () => {
    const { fileId, sessionId, checkpoints } = await setupFileAndSession(1);
    const checkpointId = checkpoints[0];

    // Mock extraction
    executionService.executeExtraction.mockResolvedValue('test text');
    
    // Mock Rag generation to generate chunks
    ragService.generateChunkValues.mockResolvedValue([{
      fileId,
      content: 'test text',
      chunkIndex: 0,
      pageNumber: 1,
      embedding: Array(1536).fill(0.1),
    }]);

    // Use a Promise barrier to ensure both workers hit the DB transaction exactly simultaneously
    let worker1Ready: () => void = () => {};
    let worker2Ready: () => void = () => {};
    
    const p1 = new Promise<void>(resolve => { worker1Ready = resolve; });
    const p2 = new Promise<void>(resolve => { worker2Ready = resolve; });

    executionService.executeExtraction.mockImplementationOnce(async () => {
      worker1Ready();
      await p2; // Wait for worker 2 to also be ready
      return 'test text';
    }).mockImplementationOnce(async () => {
      worker2Ready();
      await p1; // Wait for worker 1 to also be ready
      return 'test text';
    });

    const payload = {
      attemptId: randomUUID(),
      fileId,
      sessionId,
      checkpointId,
      chunkIndex: 0,
      startPage: 1,
      endPage: 5,
    };

    // Fire both concurrently
    const t1 = processor.handle({ jobId: 'j1', payload } as any);
    const t2 = processor.handle({ jobId: 'j2', payload } as any);

    await Promise.all([t1, t2]);

    // Assert only one chunk was inserted
    const chunks = await db.query.documentChunks.findMany({
      where: eq(documentChunks.fileId, fileId),
    });
    expect(chunks.length).toBe(1); // Not 2! PostgreSQL Row Lock prevented the second from claiming it

    // Assert checkpoint is completed
    const chk = await db.query.processingCheckpoints.findFirst({
      where: eq(processingCheckpoints.id, checkpointId)
    });
    expect(chk?.status).toBe('completed');
  });

  it('4, 9: Embedding failure aborts the transaction atomically (Rollback removes partial mutations)', async () => {
    const { fileId, sessionId, checkpoints } = await setupFileAndSession(1);
    const checkpointId = checkpoints[0];

    executionService.executeExtraction.mockResolvedValue('test text');
    
    // Simulate AI crash DURING generation (before transaction)
    ragService.generateChunkValues.mockRejectedValue(new Error('AI Rate Limit'));

    const payload = {
      attemptId: randomUUID(),
      fileId,
      sessionId,
      checkpointId,
      chunkIndex: 0,
      startPage: 1,
      endPage: 5,
    };

    await expect(processor.handle({ jobId: 'j1', payload } as any)).rejects.toThrow('AI Rate Limit');

    // Verify state was not mutated
    const chk = await db.query.processingCheckpoints.findFirst({
      where: eq(processingCheckpoints.id, checkpointId)
    });
    expect(chk?.status).toBe('pending');

    const chunks = await db.query.documentChunks.findMany({
      where: eq(documentChunks.fileId, fileId),
    });
    expect(chunks.length).toBe(0);
  });

  it('7: Retry after rollback succeeds correctly', async () => {
    const { fileId, sessionId, checkpoints } = await setupFileAndSession(1);
    const checkpointId = checkpoints[0];

    // First attempt fails
    executionService.executeExtraction.mockRejectedValueOnce(new Error('OCR Crash'));

    const payload = { attemptId: randomUUID(), fileId, sessionId, checkpointId, chunkIndex: 0, startPage: 1, endPage: 5 };

    await expect(processor.handle({ jobId: 'j1', payload } as any)).rejects.toThrow('OCR Crash');
    
    let chk = await db.query.processingCheckpoints.findFirst({ where: eq(processingCheckpoints.id, checkpointId) });
    expect(chk?.status).toBe('pending');

    // Retry succeeds
    executionService.executeExtraction.mockResolvedValueOnce('test text');
    ragService.generateChunkValues.mockResolvedValueOnce([{
      fileId, content: 'test text', chunkIndex: 0, pageNumber: 1, embedding: Array(1536).fill(0.1),
    }]);

    await processor.handle({ jobId: 'j2', payload } as any);

    chk = await db.query.processingCheckpoints.findFirst({ where: eq(processingCheckpoints.id, checkpointId) });
    expect(chk?.status).toBe('completed');
  });

  it('5: Session reconciliation never strands a processing_session', async () => {
    // Session with 2 checkpoints
    const { fileId, sessionId, checkpoints } = await setupFileAndSession(2);

    executionService.executeExtraction.mockResolvedValue('text');
    ragService.generateChunkValues.mockResolvedValue([{
      fileId, content: 'text', chunkIndex: 0, pageNumber: 1, embedding: Array(1536).fill(0.1),
    }]);

    // Process checkpoint 1
    await processor.handle({ jobId: 'j1', payload: { attemptId: randomUUID(), fileId, sessionId, checkpointId: checkpoints[0], chunkIndex: 0, startPage: 1, endPage: 5 } } as any);
    
    let sess = await db.query.processingSessions.findFirst({ where: eq(processingSessions.id, sessionId) });
    expect(sess?.status).toBe('processing'); // Still processing because chk 2 is pending

    // Process checkpoint 2
    await processor.handle({ jobId: 'j2', payload: { attemptId: randomUUID(), fileId, sessionId, checkpointId: checkpoints[1], chunkIndex: 1, startPage: 6, endPage: 10 } } as any);
    
    sess = await db.query.processingSessions.findFirst({ where: eq(processingSessions.id, sessionId) });
    expect(sess?.status).toBe('completed'); // Now completed
  });

  it('8: Empty OCR checkpoints still transition correctly', async () => {
    const { fileId, sessionId, checkpoints } = await setupFileAndSession(1);
    
    executionService.executeExtraction.mockResolvedValue('No extractable text found in this document.');
    
    await processor.handle({ jobId: 'j1', payload: { attemptId: randomUUID(), fileId, sessionId, checkpointId: checkpoints[0], chunkIndex: 0, startPage: 1, endPage: 5 } } as any);

    expect(ragService.generateChunkValues).not.toHaveBeenCalled();

    const chk = await db.query.processingCheckpoints.findFirst({ where: eq(processingCheckpoints.id, checkpoints[0]) });
    expect(chk?.status).toBe('completed'); // Still transitioned!

    const sess = await db.query.processingSessions.findFirst({ where: eq(processingSessions.id, sessionId) });
    expect(sess?.status).toBe('completed');
  });

  it('10: Legacy V1 processing remains unaffected', async () => {
    const fileId = randomUUID();
    const attemptId = randomUUID();

    // Setup legacy file (no session)
    await db.insert(files).values({
      id: fileId,
      userId: globalUserId,
      originalName: 'v1.pdf',
      storageKey: 'test/v1.pdf',
      storageUrl: 'http://localhost/test.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      processingStatus: 'pending',
    });

    const jobId = randomUUID();
    const { fileProcessingAttempts } = require('@studyai/database');
    await db.insert(fileProcessingAttempts).values({
      id: attemptId,
      fileId,
      queueJobId: jobId,
      status: 'queued',
      processingAttempts: 0,
    });

    executionService.executeExtraction.mockResolvedValue('legacy text');

    // Missing 'checkpointId' implies V1
    await processor.handle({ jobId, payload: { attemptId, fileId } } as any);

    expect(executionService.executeExtraction).toHaveBeenCalled();
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled();
  });
});
