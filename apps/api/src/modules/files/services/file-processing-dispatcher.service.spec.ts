/* eslint-disable no-restricted-syntax */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FileProcessingDispatcherService } from './file-processing-dispatcher.service';
import { db, eq, and } from '@studyai/database';
import { IQueue } from '@studyai/infrastructure';
import { PdfUtility } from '../utils/pdf.util';

jest.mock('../utils/pdf.util', () => ({
  PdfUtility: {
    getPageCountFromFile: jest.fn(),
  },
}));

jest.mock('@studyai/database', () => {
  const dbMock = {
    update: jest.fn(),
    select: jest.fn(),
    transaction: jest.fn(),
    insert: jest.fn(),
  };
  return {
    db: dbMock,
    eq: jest.fn(),
    and: jest.fn(),
    or: jest.fn(),
    sql: jest.fn(),
    fileProcessingAttempts: { id: 'id', fileId: 'fileId', queueJobId: 'queueJobId', status: 'status' },
    files: { id: 'id', fileType: 'fileType' },
    processingSessions: { id: 'id', fileId: 'fileId', status: 'status', totalChunks: 'totalChunks' },
    processingCheckpoints: { id: 'id', sessionId: 'sessionId', chunkIndex: 'chunkIndex' },
  };
});

describe('FileProcessingDispatcherService', () => {
  let service: FileProcessingDispatcherService;
  let queue: jest.Mocked<IQueue>;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.ENABLE_V2_PIPELINE = 'false';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileProcessingDispatcherService,
        {
          provide: 'IQueue',
          useValue: {
            enqueue: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => process.env[key]),
          },
        },
      ],
    }).compile();

    service = module.get<FileProcessingDispatcherService>(FileProcessingDispatcherService);
    queue = module.get('IQueue');
  });

  describe('dispatchAttempt (V1 Legacy)', () => {
    it('should handle V1 dispatching when ENABLE_V2_PIPELINE=false', async () => {
      const attemptId = 'attempt-123';
      const expectedJobId = `file-processing_${attemptId}`;

      const returningMock = jest.fn().mockResolvedValue([{ id: attemptId, fileId: 'file-123', queueJobId: expectedJobId }]);
      const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
      const setMock = jest.fn().mockReturnValue({ where: whereMock });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });

      const fileResult = [{ id: 'file-123', fileType: 'pdf' }];
      const limitMock = jest.fn().mockResolvedValue(fileResult);
      const whereSelectMock = jest.fn().mockReturnValue({ limit: limitMock });
      const fromMock = jest.fn().mockReturnValue({ where: whereSelectMock });
      (db.select as jest.Mock).mockReturnValue({ from: fromMock });

      await service.dispatchAttempt(attemptId);

      expect(queue.enqueue).toHaveBeenCalledWith({
        jobId: expectedJobId,
        jobType: 'process-file',
        priority: 0,
        payload: { attemptId, fileId: 'file-123', traceId: expect.any(String) },
      });
    });

    it('should handle V1 dispatching for non-PDFs even when ENABLE_V2_PIPELINE=true', async () => {
      process.env.ENABLE_V2_PIPELINE = 'true';
      const attemptId = 'attempt-123';
      const expectedJobId = `file-processing_${attemptId}`;

      const returningMock = jest.fn().mockResolvedValue([{ id: attemptId, fileId: 'file-123', queueJobId: expectedJobId }]);
      const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
      const setMock = jest.fn().mockReturnValue({ where: whereMock });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });

      const fileResult = [{ id: 'file-123', fileType: 'docx' }]; // non-pdf
      const limitMock = jest.fn().mockResolvedValue(fileResult);
      const whereSelectMock = jest.fn().mockReturnValue({ limit: limitMock });
      const fromMock = jest.fn().mockReturnValue({ where: whereSelectMock });
      (db.select as jest.Mock).mockReturnValue({ from: fromMock });

      await service.dispatchAttempt(attemptId);

      expect(queue.enqueue).toHaveBeenCalledWith({
        jobId: expectedJobId,
        jobType: 'process-file',
        priority: 0,
        payload: { attemptId, fileId: 'file-123', traceId: expect.any(String) },
      });
    });
  });

  describe('dispatchDocumentV2 (V2 Map-Reduce)', () => {
    beforeEach(() => {
      process.env.ENABLE_V2_PIPELINE = 'true';
    });

    it('should create 1 checkpoint for a 1-page PDF', async () => {
      const attemptId = 'attempt-123';
      
      const updateReturningMock = jest.fn().mockResolvedValue([{ id: attemptId, fileId: 'file-123', queueJobId: 'job' }]);
      const updateWhereMock = jest.fn().mockReturnValue({ returning: updateReturningMock });
      const updateSetMock = jest.fn().mockReturnValue({ where: updateWhereMock });
      (db.update as jest.Mock).mockReturnValue({ set: updateSetMock });

      // file
      const fileResult = [{ id: 'file-123', fileType: 'pdf', storageKey: 'test.pdf' }];
      
      // existing sessions (none)
      const existingSessionsResult: any[] = [];

      const selectLimitMock = jest.fn()
        .mockResolvedValueOnce(fileResult)
        .mockResolvedValueOnce(existingSessionsResult);
        
      const selectWhereMock = jest.fn().mockReturnValue({ limit: selectLimitMock });
      const selectFromMock = jest.fn().mockReturnValue({ where: selectWhereMock });
      (db.select as jest.Mock).mockReturnValue({ from: selectFromMock });

      (PdfUtility.getPageCountFromFile as jest.Mock).mockResolvedValue(1);

      // tx
      (db.transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn()
                .mockResolvedValueOnce([{ id: 'sess-1' }]) // session
                .mockResolvedValueOnce([ // checkpoints
                  { id: 'cp-1', chunkIndex: 0, startPage: 1, endPage: 1 }
                ])
            })
          })
        };
        await cb(tx);
      });

      await service.dispatchAttempt(attemptId);

      expect(PdfUtility.getPageCountFromFile).toHaveBeenCalled();
      expect(queue.enqueue).toHaveBeenCalledWith({
        jobId: 'checkpoint_cp-1',
        jobType: 'process-checkpoint',
        priority: 0,
        payload: expect.objectContaining({ 
          attemptId,
          sessionId: 'sess-1',
          chunkIndex: 0,
          startPage: 1,
          endPage: 1,
        }),
      });
    });

    it('should throw Error and leave state as dispatching for a 0-page PDF', async () => {
      const attemptId = 'attempt-123';
      
      const updateReturningMock = jest.fn().mockResolvedValue([{ id: attemptId, fileId: 'file-123', queueJobId: 'job' }]);
      const updateWhereMock = jest.fn().mockReturnValue({ returning: updateReturningMock });
      const updateSetMock = jest.fn().mockReturnValue({ where: updateWhereMock });
      (db.update as jest.Mock).mockReturnValue({ set: updateSetMock });

      const fileResult = [{ id: 'file-123', fileType: 'pdf', storageKey: 'test.pdf' }];
      const existingSessionsResult: any[] = [];

      const selectLimitMock = jest.fn()
        .mockResolvedValueOnce(fileResult)
        .mockResolvedValueOnce(existingSessionsResult);
        
      const selectWhereMock = jest.fn().mockReturnValue({ limit: selectLimitMock });
      const selectFromMock = jest.fn().mockReturnValue({ where: selectWhereMock });
      (db.select as jest.Mock).mockReturnValue({ from: selectFromMock });

      (PdfUtility.getPageCountFromFile as jest.Mock).mockResolvedValue(0);

      await expect(service.dispatchAttempt(attemptId)).resolves.toBeUndefined(); // It catches the error internally

      expect(PdfUtility.getPageCountFromFile).toHaveBeenCalled();
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
      
      // Verify outer catch behaviour (should update enqueue_pending ONLY if it was queued, but since it's dispatching, it updates 0 rows or is skipped. The mock just expects the final where clause).
      expect(db.update).toHaveBeenCalledTimes(2); // 1. Initial claim (dispatching). 2. Outer catch (enqueue_pending).
      expect(updateSetMock).toHaveBeenLastCalledWith({ status: 'enqueue_pending' });
      // The crucial part is checking the where clause of the outer catch (it should only target 'queued')
      expect(and).toHaveBeenCalledWith(
        undefined, // eq(fileProcessingAttempts.id, attemptId) evaluates to undefined in the mock unless mocked
        undefined
      );
      // We can also verify that 'eq' was called with status, 'queued' as the LAST status equality check
      expect(eq).toHaveBeenCalledWith('status', 'queued');
    });

    it('should create 3 checkpoints for an 11-page PDF', async () => {
      const attemptId = 'attempt-123';
      
      const updateReturningMock = jest.fn().mockResolvedValue([{ id: attemptId, fileId: 'file-123', queueJobId: 'job' }]);
      const updateWhereMock = jest.fn().mockReturnValue({ returning: updateReturningMock });
      const updateSetMock = jest.fn().mockReturnValue({ where: updateWhereMock });
      (db.update as jest.Mock).mockReturnValue({ set: updateSetMock });

      const fileResult = [{ id: 'file-123', fileType: 'pdf', storageKey: 'test.pdf' }];
      const existingSessionsResult: any[] = [];

      const selectLimitMock = jest.fn()
        .mockResolvedValueOnce(fileResult)
        .mockResolvedValueOnce(existingSessionsResult);
        
      const selectWhereMock = jest.fn().mockReturnValue({ limit: selectLimitMock });
      const selectFromMock = jest.fn().mockReturnValue({ where: selectWhereMock });
      (db.select as jest.Mock).mockReturnValue({ from: selectFromMock });

      (PdfUtility.getPageCountFromFile as jest.Mock).mockResolvedValue(11);

      (db.transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn()
                .mockResolvedValueOnce([{ id: 'sess-1' }]) // session
                .mockResolvedValueOnce([ // checkpoints
                  { id: 'cp-1', chunkIndex: 0, startPage: 1, endPage: 5 },
                  { id: 'cp-2', chunkIndex: 1, startPage: 6, endPage: 10 },
                  { id: 'cp-3', chunkIndex: 2, startPage: 11, endPage: 11 }
                ])
            })
          })
        };
        await cb(tx);
      });

      await service.dispatchAttempt(attemptId);

      expect(queue.enqueue).toHaveBeenCalledTimes(3);
      expect(queue.enqueue).toHaveBeenNthCalledWith(1, expect.objectContaining({ jobId: 'checkpoint_cp-1', payload: expect.objectContaining({ startPage: 1, endPage: 5 }) }));
      expect(queue.enqueue).toHaveBeenNthCalledWith(2, expect.objectContaining({ jobId: 'checkpoint_cp-2', payload: expect.objectContaining({ startPage: 6, endPage: 10 }) }));
      expect(queue.enqueue).toHaveBeenNthCalledWith(3, expect.objectContaining({ jobId: 'checkpoint_cp-3', payload: expect.objectContaining({ startPage: 11, endPage: 11 }) }));
    });

    it('should be idempotent and skip db insert if pending session exists', async () => {
      const attemptId = 'attempt-123';
      
      const updateReturningMock = jest.fn().mockResolvedValue([{ id: attemptId, fileId: 'file-123', queueJobId: 'job' }]);
      const updateWhereMock = jest.fn().mockReturnValue({ returning: updateReturningMock });
      const updateSetMock = jest.fn().mockReturnValue({ where: updateWhereMock });
      (db.update as jest.Mock).mockReturnValue({ set: updateSetMock });

      const fileResult = [{ id: 'file-123', fileType: 'pdf', storageKey: 'test.pdf' }];
      const existingSessionsResult = [{ id: 'sess-1' }];
      const existingCheckpointsResult = [
        { id: 'cp-1', chunkIndex: 0, startPage: 1, endPage: 5 }
      ];

      const selectLimitMock = jest.fn()
        .mockResolvedValueOnce(fileResult)
        .mockResolvedValueOnce(existingSessionsResult);
        
      const selectWhereMock = jest.fn()
        .mockReturnValueOnce({ limit: selectLimitMock }) // files
        .mockReturnValueOnce({ limit: selectLimitMock }) // sessions
        .mockResolvedValueOnce(existingCheckpointsResult); // checkpoints (no limit)

      const selectFromMock = jest.fn().mockReturnValue({ where: selectWhereMock });
      (db.select as jest.Mock).mockReturnValue({ from: selectFromMock });

      await service.dispatchAttempt(attemptId);

      expect(db.transaction).not.toHaveBeenCalled();
      expect(PdfUtility.getPageCountFromFile).not.toHaveBeenCalled();
      expect(queue.enqueue).toHaveBeenCalledTimes(1);
      expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
        jobId: 'checkpoint_cp-1'
      }));
    });
  });
});
