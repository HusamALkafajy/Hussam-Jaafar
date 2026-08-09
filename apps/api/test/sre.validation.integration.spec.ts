import { Test, TestingModule } from '@nestjs/testing';
import { FilesProcessor } from '../src/modules/files/files.processor';
import { RagService } from '../src/modules/rag/rag.service';
import { FileProcessingStateRepository } from '../src/modules/files/repositories/file-processing-state.repository';
import { DocumentPersistenceService } from '../src/modules/files/services/document-persistence.service';
import { PipelineRunner } from '../src/modules/files/services/pipeline/pipeline-runner';
import { RetryableRateLimitError } from '../src/modules/files/utils/domain.exceptions';
import { EmptyDocumentError } from '../src/modules/files/contracts/document-extractor';
import { eq, db, files, users, fileProcessingAttempts, processingSessions, processingCheckpoints, documentChunks, documentVersions } from '@studyai/database';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

describe('SRE Production Readiness Validation', () => {
  let processor: FilesProcessor;
  let pipelineRunner: { execute: jest.Mock };
  let ragService: jest.Mocked<RagService>;

  const globalUserId = randomUUID();

  beforeAll(async () => {
    pipelineRunner = { execute: jest.fn() };

    ragService = {
      generateChunkValues: jest.fn(),
      indexFile: jest.fn(),
      searchChunks: jest.fn(),
      persistChunks: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesProcessor,
        FileProcessingStateRepository,
        DocumentPersistenceService,
        { provide: PipelineRunner, useValue: pipelineRunner },
        { provide: RagService, useValue: ragService },
        {
          provide: 'IStorageProvider',
          useValue: {
            download: jest.fn().mockResolvedValue(Readable.from(Buffer.from('pdf fixture'))),
          },
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
    pipelineRunner.execute.mockReset();
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

    pipelineRunner.execute.mockResolvedValue({
      extractedDocument: {
        fullText: 'small text',
        blocks: [{ type: 'paragraph', text: 'test text', metadata: { sourcePage: 1 } }],
      },
      chunks: [{
        plainText: 'small text',
        chunkOrder: 0,
        structuralMetadata: { sourcePages: [1] },
      }],
    });

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

    pipelineRunner.execute.mockRejectedValue(
      new EmptyDocumentError('PDF extraction returned no usable text.'),
    );

    await processor.handle({
      jobId: queueJobId,
      payload: { attemptId, fileId }
    } as any);

    expect(ragService.persistChunks).not.toHaveBeenCalled();

    const f = await db.query.files.findFirst({ where: eq(files.id, fileId) });
    const a = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptId) });

    expect({
      fileStatus: f?.processingStatus,
      attemptStatus: a?.status
    }).toEqual({
      fileStatus: 'failed',
      attemptStatus: 'failed'
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
    const { fileId, attemptId, queueJobId } = await setupFile();

    pipelineRunner.execute.mockRejectedValue(
      new RetryableRateLimitError('AI provider rate limit'),
    );

    await processor.handle({
      jobId: queueJobId,
      payload: { attemptId, fileId }
    } as any);

    const a = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptId) });
    expect(a?.status).toBe('retrying');

    const chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.fileId, fileId) });
    expect(chunks.length).toBe(0);

    // Also verify no version was published
    const versions = await db.query.documentVersions.findMany({ where: eq(documentVersions.fileId, fileId) });
    expect(versions.length).toBe(0);
  });
});
