import { Test, TestingModule } from '@nestjs/testing';
import { FilesProcessor } from '../src/modules/files/files.processor';
import { ExtractorRegistry } from '../src/modules/files/services/extractor.registry';
import { FileProcessingStateRepository } from '../src/modules/files/repositories/file-processing-state.repository';
import { DocumentPersistenceService } from '../src/modules/files/services/document-persistence.service';
import { RagService } from '../src/modules/rag/rag.service';
import { db, files, fileProcessingAttempts, users } from '@studyai/database';
import { v4 as uuidv4 } from 'uuid';
import { getToken } from '@willsoto/nestjs-prometheus';

import { DocumentExtractor, DocumentExtractionContext } from '../src/modules/files/contracts/document-extractor';
import { ExtractedDocument } from '../src/modules/files/contracts/extracted-document';

class HangingExtractor implements DocumentExtractor {
  async extract(context: DocumentExtractionContext): Promise<ExtractedDocument> {
    return new Promise((resolve, reject) => {
      // Simulate a parser that hangs indefinitely unless aborted
      if (context.signal) {
        if (context.signal.aborted) {
          return reject(context.signal.reason || new Error('Aborted'));
        }
        context.signal.addEventListener('abort', () => {
          reject(context.signal?.reason || new Error('Aborted'));
        });
      }
    });
  }
}

describe('FilesProcessor Timeout Integration', () => {
  let processor: FilesProcessor;
  let registry: ExtractorRegistry;
  let stateRepository: FileProcessingStateRepository;

  beforeAll(async () => {
    
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FilesProcessor,
        ExtractorRegistry,
        FileProcessingStateRepository,
        {
          provide: DocumentPersistenceService,
          useValue: { publish: jest.fn() }
        },
        {
          provide: RagService,
          useValue: { generateChunkValues: jest.fn().mockResolvedValue([]) }
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
    registry = moduleRef.get<ExtractorRegistry>(ExtractorRegistry);
    stateRepository = moduleRef.get<FileProcessingStateRepository>(FileProcessingStateRepository);

    registry.register('application/pdf', new HangingExtractor());
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
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb: any, ms?: number) => {
      if (ms === 300_000) {
        return setImmediate(cb) as any;
      }
      return setTimeout(cb, ms) as any;
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
