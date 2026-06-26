import { Test, TestingModule } from '@nestjs/testing';
import { FilesProcessor } from './files.processor';
import { FileProcessingExecutionService } from './services/file-processing-execution.service';
import { RagService } from '../rag/rag.service';
import { db } from '@studyai/database';

jest.mock('@studyai/database', () => {
  const original = jest.requireActual('@studyai/database');
  return {
    ...original,
    db: {
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ id: 'test-attempt-id' }]),
            then: function(resolve: any, reject: any) {
              return Promise.resolve([{ id: 'test-attempt-id' }]).then(resolve, reject);
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesProcessor,
        {
          provide: FileProcessingExecutionService,
          useValue: {
            executeExtraction: jest.fn().mockResolvedValue({ extractedText: 'extracted' }),
          },
        },
        {
          provide: RagService,
          useValue: {
            indexFile: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    processor = module.get<FilesProcessor>(FilesProcessor);
    executionService = module.get(FileProcessingExecutionService);
    ragService = module.get(RagService);
  });

  it('should discard missing attempt (malformed payload)', async () => {
    const job: any = { data: {}, id: 'job-1' };
    await processor.process(job);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('should discard queue job ID mismatch (missing job ID)', async () => {
    const job: any = { data: { attemptId: 'att-1', fileId: 'file-1' }, id: undefined };
    await processor.process(job);
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

    const job: any = { data: { attemptId: 'att-1', fileId: 'file-1' }, id: 'job-1' };
    await processor.process(job);
    expect(executionService.executeExtraction).not.toHaveBeenCalled();
  });

  it('should complete and update file and attempt atomically', async () => {
    const job: any = { data: { attemptId: 'att-1', fileId: 'file-1' }, id: 'job-1' };
    await processor.process(job);
    expect(executionService.executeExtraction).toHaveBeenCalled();
    expect(db.transaction).toHaveBeenCalled();
    expect(ragService.indexFile).toHaveBeenCalled();
  });

  it('should handle failure atomically', async () => {
    executionService.executeExtraction.mockResolvedValueOnce({ extractedText: '', error: 'failed' });
    const job: any = { data: { attemptId: 'att-1', fileId: 'file-1' }, id: 'job-1' };
    await processor.process(job);
    expect(db.transaction).toHaveBeenCalled(); // Failure handler uses transaction
    expect(ragService.indexFile).not.toHaveBeenCalled();
  });
});
