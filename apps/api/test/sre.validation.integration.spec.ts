import { Test, TestingModule } from '@nestjs/testing';
import { FilesProcessor } from '../src/modules/files/files.processor';
import { FileProcessingDispatcherService } from '../src/modules/files/services/file-processing-dispatcher.service';
import { FileProcessingExecutionService } from '../src/modules/files/services/file-processing-execution.service';
import { RagService } from '../src/modules/rag/rag.service';
import { FileProcessingStateRepository } from '../src/modules/files/repositories/file-processing-state.repository';
import { DocumentPersistenceService } from '../src/modules/files/services/document-persistence.service';
import { eq, and, db, files, users, fileProcessingAttempts, processingSessions, processingCheckpoints, documentChunks } from '@studyai/database';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { IQueue } from '@studyai/infrastructure';

describe('SRE Production Readiness Validation', () => {
  let processor: FilesProcessor;
  let dispatcher: FileProcessingDispatcherService;
  let executionService: jest.Mocked<FileProcessingExecutionService>;
  let ragService: jest.Mocked<RagService>;
  let stateRepository: FileProcessingStateRepository;
  let queue: jest.Mocked<IQueue>;

  const globalUserId = randomUUID();

  beforeAll(async () => {
    executionService = {
      executeExtraction: jest.fn(),
    } as any;

    ragService = {
      generateChunkValues: jest.fn(),
      indexFile: jest.fn(),
      searchChunks: jest.fn(),
      persistChunks: jest.fn().mockResolvedValue(undefined),
    } as any;

    queue = {
      enqueue: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesProcessor,
        FileProcessingDispatcherService,
        FileProcessingStateRepository,
        DocumentPersistenceService,
        { provide: FileProcessingExecutionService, useValue: executionService },
        { provide: RagService, useValue: ragService },
        { provide: 'IQueue', useValue: queue },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('true'),
          },
        },
        {
          provide: 'studyai_worker_jobs_total',
          useValue: { labels: () => ({ inc: jest.fn() }) },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_JOBS_TOTAL',
          useValue: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_CHECKPOINT_JOBS_TOTAL',
          useValue: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_OCR_DURATION_SECONDS',
          useValue: { startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnValue({ observe: jest.fn() }) },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_EMBEDDING_DURATION_SECONDS',
          useValue: { startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnValue({ observe: jest.fn() }) },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_TRANSACTION_DURATION_SECONDS',
          useValue: { startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnValue({ observe: jest.fn() }) },
        },
      ],
    }).compile();

    processor = module.get<FilesProcessor>(FilesProcessor);
    dispatcher = module.get<FileProcessingDispatcherService>(FileProcessingDispatcherService);
    stateRepository = module.get<FileProcessingStateRepository>(FileProcessingStateRepository);

    await db.insert(users).values({
      id: globalUserId,
      email: `sre-${Date.now()}@test.com`,
      passwordHash: 'hash',
      firstName: 'SRE',
      lastName: 'Validator',
      role: 'student',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const setupFile = async () => {
    const fileId = randomUUID();
    const attemptId = randomUUID();
    const queueJobId = `job-${attemptId}`;

    await db.insert(files).values({
      id: fileId,
      userId: globalUserId,
      originalName: 'test.pdf',
      storageKey: 'test/test.pdf',
      storageUrl: 'http://localhost/test.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      processingStatus: 'pending',
    });

    await db.insert(fileProcessingAttempts).values({
      id: attemptId,
      fileId,
      queueJobId,
      status: 'queued',
      processingAttempts: 0,
    });

    return { fileId, attemptId, queueJobId };
  };

  it('Scenario 1: Small PDF (End-to-End)', async () => {
    const { fileId, attemptId, queueJobId } = await setupFile();
    
    const sessionId = randomUUID();
    const checkpointId = randomUUID();
    await db.insert(processingSessions).values({ id: sessionId, fileId, status: 'pending', totalChunks: 1 });
    await db.insert(processingCheckpoints).values({ id: checkpointId, sessionId, chunkIndex: 0, startPage: 1, endPage: 5, status: 'pending' });

    executionService.executeExtraction.mockResolvedValue('small text');
    ragService.generateChunkValues.mockResolvedValue([{
      fileId, content: 'small text', chunkIndex: 0, pageNumber: 1, embedding: Array(1536).fill(0.1),
    }]);

    await processor.handle({
      jobId: queueJobId,
      payload: { attemptId, fileId, generation: 1 }
    } as any);

    // Verify terminal states
    const f = await db.query.files.findFirst({ where: eq(files.id, fileId) });
    const a = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptId) });
    
    expect({ 
      fileStatus: f?.processingStatus, 
      attemptStatus: a?.status 
    }).toEqual({ 
      fileStatus: 'completed', 
      attemptStatus: 'completed' 
    });
  });

  it('Scenario 3: Empty PDF', async () => {
    const { fileId, attemptId, queueJobId } = await setupFile();
    const sessionId = randomUUID();
    const checkpointId = randomUUID();
    await db.insert(processingSessions).values({ id: sessionId, fileId, status: 'pending', totalChunks: 1 });
    await db.insert(processingCheckpoints).values({ id: checkpointId, sessionId, chunkIndex: 0, startPage: 1, endPage: 5, status: 'pending' });

    executionService.executeExtraction.mockResolvedValue('No extractable text found in this document.');
    
    await processor.handle({
      jobId: queueJobId,
      payload: { attemptId, fileId, generation: 1 }
    } as any);

    expect(ragService.generateChunkValues).not.toHaveBeenCalled();

    const f = await db.query.files.findFirst({ where: eq(files.id, fileId) });
    const a = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptId) });
    
    expect({ 
      fileStatus: f?.processingStatus, 
      attemptStatus: a?.status 
    }).toEqual({ 
      fileStatus: 'completed', 
      attemptStatus: 'completed' 
    });
  });

  it('Scenario 4: Corrupted PDF (Infinite Retry Prevention)', async () => {
    const { fileId, attemptId } = await setupFile();
    
    await db.update(fileProcessingAttempts).set({ status: 'queued', queueJobId: 'q4', processingAttempts: 5 }).where(eq(fileProcessingAttempts.id, attemptId));

    await processor.handle({
      jobId: 'q4',
      payload: { attemptId, fileId }
    } as any);

    const f = await db.query.files.findFirst({ where: eq(files.id, fileId) });
    expect(f?.processingStatus).toBe('failed');
    
    const a = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptId) });
    expect(a?.status).toBe('failed');
    expect(a?.errorCode).toBe('SYSTEM_CRASH_LIMIT');
  });

  it('Scenario 5: AI Provider Failure (Transaction Rollback)', async () => {
    const { fileId, attemptId } = await setupFile();
    const sessionId = randomUUID();
    const checkpointId = randomUUID();
    await db.insert(processingSessions).values({ id: sessionId, fileId, status: 'pending', totalChunks: 1 });
    await db.insert(processingCheckpoints).values({ id: checkpointId, sessionId, chunkIndex: 0, startPage: 1, endPage: 5, status: 'pending' });

    executionService.executeExtraction.mockResolvedValue('text');
    ragService.generateChunkValues.mockRejectedValue(new Error('AI Rate Limit (429)'));

    await expect(processor.handle({
      jobId: 'q5',
      payload: { attemptId, fileId, sessionId, checkpointId, chunkIndex: 0, startPage: 1, endPage: 5 }
    } as any)).rejects.toThrow('AI Rate Limit (429)');

    const c = await db.query.processingCheckpoints.findFirst({ where: eq(processingCheckpoints.id, checkpointId) });
    expect(c?.status).toBe('pending');
    
    const chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.fileId, fileId) });
    expect(chunks.length).toBe(0);
  });
});
