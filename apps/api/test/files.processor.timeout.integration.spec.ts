import { Test, TestingModule } from '@nestjs/testing';
import { FilesProcessor } from '../src/modules/files/files.processor';
import { FileProcessingStateRepository } from '../src/modules/files/repositories/file-processing-state.repository';
import { DocumentPersistenceService } from '../src/modules/files/services/document-persistence.service';
import { PipelineRunner } from '../src/modules/files/services/pipeline/pipeline-runner';
import { db, files, fileProcessingAttempts, users } from '@studyai/database';
import { v4 as uuidv4 } from 'uuid';
import { getToken } from '@willsoto/nestjs-prometheus';
import { Readable } from 'stream';

const hangingPipelineRunner = {
  execute: jest.fn((_input: unknown, context: { signal: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      if (context.signal.aborted) {
        reject(context.signal.reason || new Error('Aborted'));
        return;
      }
      context.signal.addEventListener('abort', () => {
        reject(context.signal.reason || new Error('Aborted'));
      });
    }),
  ),
};

describe('FilesProcessor Timeout Integration', () => {
  let processor: FilesProcessor;

  beforeAll(async () => {
    
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FilesProcessor,
        FileProcessingStateRepository,
        { provide: PipelineRunner, useValue: hangingPipelineRunner },
        {
          provide: DocumentPersistenceService,
          useValue: { publish: jest.fn() }
        },
        {
          provide: 'IStorageProvider',
          useValue: {
            download: jest.fn().mockResolvedValue(Readable.from(Buffer.from('pdf fixture'))),
          },
        },
        {
          provide: getToken('studyai_worker_jobs_total'),
          useValue: { labels: () => ({ inc: jest.fn() }) }
        },
        {
          provide: getToken('studyai_worker_checkpoint_jobs_total'),
          useValue: { labels: () => ({ inc: jest.fn() }) }
        },
        {
          provide: getToken('studyai_worker_ocr_duration_seconds'),
          useValue: { startTimer: jest.fn().mockReturnValue(jest.fn()) }
        },
        {
          provide: getToken('studyai_worker_embedding_duration_seconds'),
          useValue: { startTimer: jest.fn().mockReturnValue(jest.fn()) }
        },
        {
          provide: getToken('studyai_worker_transaction_duration_seconds'),
          useValue: { startTimer: jest.fn().mockReturnValue(jest.fn()) }
        }
      ],
    }).compile();

    processor = moduleRef.get<FilesProcessor>(FilesProcessor);
  });



  it('should enforce execution boundary and transition to failed on timeout', async () => {
    const userId = uuidv4();
    const fileId = uuidv4();
    const attemptId = uuidv4();
    const queueJobId = 'job-timeout-test';

    await db.insert(users).values({
      id: userId,
      email: `${userId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(files).values({
      id: fileId,
      storageKey: 'fake.pdf',
      storageUrl: 'http://fake',
      fileSize: 100,
      mimeType: 'application/pdf',
      fileType: 'pdf',
      userId: userId,
      subjectId: null,
      originalName: 'test-timeout.pdf',
      processingStatus: 'pending'
    });

    await db.insert(fileProcessingAttempts).values({
      id: attemptId,
      fileId,
      queueJobId,
      status: 'queued',
      processingAttempts: 0,
    });

    // Mock setTimeout to instantly fire if it's our 300,000ms timeout
    const realSetTimeout = global.setTimeout;
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb: any, ms?: number) => {
      if (ms === 300_000) {
        return setImmediate(cb) as any;
      }
      return realSetTimeout(cb, ms) as any;
    });

    await processor.handle({
      data: {
        payload: { attemptId, fileId },
        jobId: queueJobId
      }
    });

    setTimeoutSpy.mockRestore();

    // Verify DB state
    const attempt = await db.query.fileProcessingAttempts.findFirst({
      where: (t, { eq }) => eq(t.id, attemptId)
    });

    expect(attempt).toBeDefined();
    expect(attempt?.status).toBe('failed');
    expect(attempt?.errorCode).toBe('EXTRACTION_TIMEOUT');
  });
});
