import { Test, TestingModule } from '@nestjs/testing';
import { FilesProcessor } from './files.processor';
import { FileProcessingExecutionService } from './services/file-processing-execution.service';
import { RagService } from '../rag/rag.service';
import { db } from '@studyai/database';
import { FileProcessingStateRepository } from './repositories/file-processing-state.repository';
import { processingCheckpoints, processingSessions, documentChunks } from '@studyai/database';

jest.mock('@studyai/database', () => {
  const original = jest.requireActual('@studyai/database');
  return {
    ...original,
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
            storageKey: 'test.pdf',
            fileType: 'pdf',
            mimeType: 'application/pdf',
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
  let executionService: jest.Mocked<FileProcessingExecutionService>;
  let ragService: jest.Mocked<RagService>;
  let stateRepository: jest.Mocked<FileProcessingStateRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesProcessor,
        {
          provide: FileProcessingExecutionService,
          useValue: {
            executeExtraction: jest.fn().mockResolvedValue('extracted'),
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
    executionService = module.get(FileProcessingExecutionService);
    ragService = module.get(RagService);
    stateRepository = module.get(FileProcessingStateRepository);
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
    expect(executionService.executeExtraction).not.toHaveBeenCalled();
  });

  it('should complete and update file and attempt atomically', async () => {
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(executionService.executeExtraction).toHaveBeenCalled();
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled();
    expect(ragService.indexFile).toHaveBeenCalled();
  });

  it('should handle failure atomically', async () => {
    executionService.executeExtraction.mockRejectedValueOnce(new Error('failed'));
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled(); // Failure handler uses transaction
    expect(ragService.indexFile).not.toHaveBeenCalled();
  });
  it('should handle failure atomically with RetryableInfrastructureError', async () => {
    const { RetryableInfrastructureError } = require('./utils/domain.exceptions');
    executionService.executeExtraction.mockRejectedValueOnce(new RetryableInfrastructureError('DB down'));
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    
    expect(db.update).toHaveBeenCalled();
    // For retrying, we don't cascade to parent file, so it doesn't call transitionToTerminal
    expect(stateRepository.transitionToTerminal).not.toHaveBeenCalled();
  });

  it('should handle failure atomically with NonRetryableValidationError', async () => {
    const { NonRetryableValidationError } = require('./utils/domain.exceptions');
    executionService.executeExtraction.mockRejectedValueOnce(new NonRetryableValidationError('Bad input'));
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled();
  });

  it('should handle native TypeError as NonRetryable', async () => {
    executionService.executeExtraction.mockRejectedValueOnce(new TypeError('Cannot read properties of undefined'));
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled();
  });

  it('should propagate AggregateError root causes to classifier', async () => {
    const { RetryableRateLimitError } = require('./utils/domain.exceptions');
    const aggregate = new AggregateError([new RetryableRateLimitError('Too many requests')]);
    executionService.executeExtraction.mockRejectedValueOnce(aggregate);
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
    
    executionService.executeExtraction.mockRejectedValueOnce(wrapper);
    const context: any = { payload: { attemptId: 'att-1', fileId: 'file-1' }, jobId: 'job-1' };
    await processor.handle(context);
    expect(stateRepository.transitionToTerminal).toHaveBeenCalled();
  });

  describe('handleCheckpoint (V2)', () => {
    let mockUpdateSetWhere: jest.Mock;
    let mockInsertValues: jest.Mock;

    const configureDbSelect = (claimResult: any[], pendingCheckpoints: any[]) => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation(() => ({
          for: jest.fn().mockResolvedValue(claimResult),
          then: function (resolve: any, reject: any) {
            return Promise.resolve(pendingCheckpoints).then(resolve, reject);
          },
        })),
      });
    };

    beforeEach(() => {
      mockUpdateSetWhere = jest.fn().mockResolvedValue([]);
      (db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: mockUpdateSetWhere,
        }),
      });

      mockInsertValues = jest.fn().mockResolvedValue([]);
      (db.insert as jest.Mock).mockReturnValue({
        values: mockInsertValues,
      });

      configureDbSelect([{ id: 'chk-1', sessionId: 'sess-1' }], []);
    });

    const defaultPayload = {
      payload: {
        checkpointId: 'chk-1',
        fileId: 'file-123',
        sessionId: 'sess-1',
        chunkIndex: 0,
        startPage: 1,
        endPage: 5,
      },
    };

    it('should complete checkpoint successfully and reconcile session (successful ownership)', async () => {
      await processor.handle(defaultPayload as any);

      expect(executionService.executeExtraction).toHaveBeenCalledWith(
        'file-123',
        expect.any(String),
        'pdf',
        'application/pdf',
        1,
        5
      );
      expect(ragService.generateChunkValues).toHaveBeenCalledWith('file-123', 'extracted', 1);
      expect(mockInsertValues).toHaveBeenCalled(); 
      expect(mockUpdateSetWhere).toHaveBeenCalledTimes(2); // checkpoint + session
      expect(db.transaction).toHaveBeenCalled();
    });

    it('should not process if checkpoint ownership fails (duplicate or completed)', async () => {
      configureDbSelect([], []);

      await processor.handle(defaultPayload as any);

      expect(mockInsertValues).not.toHaveBeenCalled();
      expect(mockUpdateSetWhere).not.toHaveBeenCalled();
    });

    it('should exit safely if file record is missing', async () => {
      (db.query.files.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await processor.handle(defaultPayload as any);
      
      expect(executionService.executeExtraction).not.toHaveBeenCalled();
    });

    it('should safely complete without generating chunks if OCR yields empty text', async () => {
      executionService.executeExtraction.mockResolvedValueOnce('No extractable text found in this document.');

      await processor.handle(defaultPayload as any);

      expect(ragService.generateChunkValues).not.toHaveBeenCalled();
      expect(mockInsertValues).not.toHaveBeenCalled();
      expect(mockUpdateSetWhere).toHaveBeenCalledTimes(2); 
    });

    it('should throw and bypass transaction if OCR execution fails', async () => {
      executionService.executeExtraction.mockRejectedValueOnce(new Error('OCR Crash'));

      await expect(processor.handle(defaultPayload as any)).rejects.toThrow('OCR Crash');
      
      expect(ragService.generateChunkValues).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should skip chunk insertion if embedding generation yields empty payload', async () => {
      ragService.generateChunkValues.mockResolvedValueOnce([]);

      await processor.handle(defaultPayload as any);

      expect(mockInsertValues).not.toHaveBeenCalled();
      expect(mockUpdateSetWhere).toHaveBeenCalledTimes(2);
    });

    it('should throw and bypass transaction if embedding generation fails', async () => {
      ragService.generateChunkValues.mockRejectedValueOnce(new Error('AI Error'));

      await expect(processor.handle(defaultPayload as any)).rejects.toThrow('AI Error');
      
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should skip session reconciliation if sibling checkpoints are still pending (concurrent execution)', async () => {
      configureDbSelect([{ id: 'chk-1', sessionId: 'sess-1' }], [{ id: 'chk-2' }]);

      await processor.handle(defaultPayload as any);

      expect(mockUpdateSetWhere).toHaveBeenCalledTimes(1); 
    });
  });
});
