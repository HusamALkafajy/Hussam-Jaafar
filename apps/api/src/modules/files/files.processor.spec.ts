import { Test, TestingModule } from '@nestjs/testing';
import { FilesProcessor } from './files.processor';
import { PipelineRunner } from './services/pipeline/pipeline-runner';
import { ExtractorRegistry } from './services/extractor.registry';
import { RagService } from '../rag/rag.service';
import { db } from '@studyai/database';
import { FileProcessingStateRepository } from './repositories/file-processing-state.repository';
import { processingCheckpoints, processingSessions, documentChunks } from '@studyai/database';

jest.mock('@studyai/database', () => {
  return {
    eq: jest.fn(),
    and: jest.fn(),
    sql: jest.fn(),
    fileProcessingAttempts: {
      id: 'id', fileId: 'fileId', queueJobId: 'queueJobId', status: 'status',
      processingAttempts: 'processingAttempts', nextRetryAt: 'nextRetryAt',
    },
    files: { id: 'id', processingStatus: 'processingStatus' },
    subjects: { id: 'id', fileCount: 'fileCount' },
    documentChunks: {},
    processingCheckpoints: {},
    processingSessions: {},
    db: {
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ id: 'test-attempt-id', processingAttempts: 0 }]),
            then: function(resolve: any, reject: any) {
              return Promise.resolve([{ id: 'test-attempt-id', processingAttempts: 0 }]).then(resolve, reject);
            }
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue([]),
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue([{ id: 'chk-1', sessionId: 'sess-1' }]),
            then: function(resolve: any, reject: any) {
              return Promise.resolve([{ id: 'chk-1', sessionId: 'sess-1' }]).then(resolve, reject);
            }
          }),
        }),
      }),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ id: 'test-attempt-id' }]),
      query: {
        files: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'file-123',
            originalName: 'test.pdf',
            storageKey: 'test.pdf',
            fileType: 'pdf',
            mimeType: 'application/pdf',
          }),
        },
        fileProcessingAttempts: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'test-attempt-id',
          }),
        },
      },
      transaction: jest.fn(async (cb) => {
        return cb(db);
      }),
    },
  };
});

describe('FilesProcessor', () => {
  let processor: FilesProcessor;
  let extractorRegistry: jest.Mocked<ExtractorRegistry>;
  let mockExtractor: any;
  let ragService: jest.Mocked<RagService>;
  let stateRepository: jest.Mocked<FileProcessingStateRepository>;
  let documentPersistenceService: any;
  let pipelineRunner: any;
  let storageProvider: { download: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockExtractor = {
      extract: jest.fn().mockResolvedValue({ fullText: 'extracted text', blocks: [] }),
    };
    storageProvider = {
      download: jest.fn().mockResolvedValue([Buffer.from('dummy')]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesProcessor,
        {
          provide: PipelineRunner,
          useValue: { execute: jest.fn().mockResolvedValue({ extractedDocument: { fullText: '', blocks: [], metadata: { pageCount: 2 } }, chunks: [] }) },
        },
        {
          provide: 'IStorageProvider',
          useValue: storageProvider,
        },
        {
          provide: ExtractorRegistry,
          useValue: {
            getExtractor: jest.fn().mockReturnValue(mockExtractor),
          },
        },
        {
          provide: RagService,
          useValue: {
            indexFile: jest.fn().mockResolvedValue(undefined),
            generateChunkValues: jest.fn().mockResolvedValue([{ fileId: 'file-1', content: 'text', chunkIndex: 0, pageNumber: 1, embedding: [0.1] }]),
          },
        },
        {
          provide: FileProcessingStateRepository,
          useValue: {
            transitionToTerminal: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: 'DocumentPersistenceService',
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: require('./services/document-persistence.service').DocumentPersistenceService,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_JOBS_TOTAL',
          useValue: {
            labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
          },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_CHECKPOINT_JOBS_TOTAL',
          useValue: {
            labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
          },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_OCR_DURATION_SECONDS',
          useValue: {
            startTimer: jest.fn().mockReturnValue(jest.fn()),
          },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_EMBEDDING_DURATION_SECONDS',
          useValue: {
            startTimer: jest.fn().mockReturnValue(jest.fn()),
          },
        },
        {
          provide: 'PROM_METRIC_STUDYAI_WORKER_TRANSACTION_DURATION_SECONDS',
          useValue: {
            startTimer: jest.fn().mockReturnValue(jest.fn()),
          },
        },
      ],
    }).compile();

    processor = module.get<FilesProcessor>(FilesProcessor);
    extractorRegistry = module.get(ExtractorRegistry);
    ragService = module.get(RagService);
    stateRepository = module.get(FileProcessingStateRepository);
    documentPersistenceService = module.get(require('./services/document-persistence.service').DocumentPersistenceService);
    pipelineRunner = module.get(PipelineRunner);
  });

  it('should discard missing attempt (malformed payload)', async () => {
    const context: any = { payload: {}, jobId: 'job-1' };
    await processor.handle(context);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('should discard queue job ID mismatch (missing job ID)', async () => {
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: undefined };
    await processor.handle(context);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('should no-op if queued -> processing atomic claim fails (0 rows updated)', async () => {
    (db.update as jest.Mock).mockReturnValueOnce({
      set: jest.fn().mockReturnValueOnce({
        where: jest.fn().mockReturnValueOnce({
          returning: jest.fn().mockResolvedValueOnce([]),
          then: function(resolve: any, reject: any) {
            return Promise.resolve([]).then(resolve, reject);
          }
        }),
      }),
    });

    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(extractorRegistry.getExtractor).not.toHaveBeenCalled();
  });

  it('should complete and update file and attempt atomically', async () => {
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(pipelineRunner.execute).toHaveBeenCalled();
    expect(documentPersistenceService.publish).toHaveBeenCalled();
    expect(documentPersistenceService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ extractionMetadata: { pageCount: 2 } }),
    );
  });

  it('should pass a disposable storage-provider download path to the pipeline', async () => {
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(pipelineRunner.execute).toHaveBeenCalled();
    const executeArgs = pipelineRunner.execute.mock.calls[0][0];
    expect(executeArgs.filePath).toBeDefined();
    expect(executeArgs.fileData).toBeUndefined();
    expect(executeArgs.fileId).toBe('file-1');
  });

  it.each([
    ['pdf', 'application/pdf', 'test.pdf'],
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'test.docx'],
    ['image', 'image/jpeg', 'test.jpg'],
    ['image', 'image/png', 'test.png'],
    ['image', 'image/webp', 'test.webp'],
  ])('downloads supported %s/%s input through the configured storage provider', async (
    fileType,
    mimeType,
    originalName,
  ) => {
    (db.query.files.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'file-123',
      userId: 'user-1',
      originalName,
      storageKey: `user-1/${originalName}`,
      fileType,
      mimeType,
    });

    await processor.handle({
      payload: { attemptId: 'att-1', fileId: 'file-1' },
      jobId: 'job-1',
    });

    expect(storageProvider.download).toHaveBeenCalledWith('documents', `user-1/${originalName}`);
    expect(pipelineRunner.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fileType, mimeType, filePath: expect.any(String) }),
      expect.any(Object),
    );
  });

  it('should handle failure atomically', async () => {
    pipelineRunner.execute.mockRejectedValueOnce(new Error('failed'));
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled(); // Failure handler uses transaction
    expect(ragService.indexFile).not.toHaveBeenCalled();
  });
  it('should handle failure atomically with RetryableInfrastructureError', async () => {
    const { RetryableInfrastructureError } = require('./utils/domain.exceptions');
    pipelineRunner.execute.mockRejectedValueOnce(new RetryableInfrastructureError('DB down'));
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    
    expect(db.update).toHaveBeenCalled();
    // For retrying, we don't cascade to parent file, so it doesn't call transitionToTerminal
    expect(stateRepository.transitionToTerminal).not.toHaveBeenCalled();
  });

  it('should handle failure atomically with NonRetryableValidationError', async () => {
    const { NonRetryableValidationError } = require('./utils/domain.exceptions');
    pipelineRunner.execute.mockRejectedValueOnce(new NonRetryableValidationError('Bad input'));
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled();
  });

  it('should handle EmptyDocumentError as non-retryable and exclude from publication', async () => {
    const { EmptyDocumentError } = require('./contracts/document-extractor');
    pipelineRunner.execute.mockRejectedValueOnce(new EmptyDocumentError('Text input is null or undefined.'));
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled();
    expect(documentPersistenceService.publish).not.toHaveBeenCalled();
  });

  it('should handle native TypeError as NonRetryable', async () => {
    pipelineRunner.execute.mockRejectedValueOnce(new TypeError('Cannot read properties of undefined'));
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled();
  });

  it('should propagate AggregateError root causes to classifier', async () => {
    const { RetryableRateLimitError } = require('./utils/domain.exceptions');
    const aggregate = new AggregateError([new RetryableRateLimitError('Too many requests')]);
    pipelineRunner.execute.mockRejectedValueOnce(aggregate);
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(db.update).toHaveBeenCalled();
    expect(stateRepository.transitionToTerminal).not.toHaveBeenCalled();
  });

  it('should propagate Error.cause to classifier', async () => {
    const { NonRetryableAuthorizationError } = require('./utils/domain.exceptions');
    const rootError = new NonRetryableAuthorizationError('No token');
    const wrapper = new Error('Wrapper');
    (wrapper as any).cause = rootError;
    
    pipelineRunner.execute.mockRejectedValueOnce(wrapper);
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled();
  });


});
