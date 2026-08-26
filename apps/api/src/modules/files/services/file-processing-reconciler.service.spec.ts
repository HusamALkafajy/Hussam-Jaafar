import { Test, TestingModule } from '@nestjs/testing';
import { FileProcessingReconcilerService } from './file-processing-reconciler.service';
import { FileProcessingDispatcherService } from './file-processing-dispatcher.service';
import { FileProcessingStateRepository } from '../repositories/file-processing-state.repository';
import { db } from '@studyai/database';

jest.mock('@studyai/database', () => ({
  db: {
    query: {
      fileProcessingAttempts: {
        findMany: jest.fn(),
      },
    },
    update: jest.fn(),
    transaction: jest.fn((cb) => cb(db)), // mock tx as using the main db instance
  },
  eq: jest.fn(),
  and: jest.fn(),
  sql: jest.fn(),
  fileProcessingAttempts: {
    status: 'status',
    dispatchLeaseStartedAt: 'dispatchLeaseStartedAt',
    nextRetryAt: 'nextRetryAt',
    id: 'id'
  },
  files: {
    id: 'id'
  }
}));

describe('FileProcessingReconcilerService', () => {
  let service: FileProcessingReconcilerService;
  let dispatcher: FileProcessingDispatcherService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileProcessingReconcilerService,
        {
          provide: FileProcessingDispatcherService,
          useValue: {
            dispatchAttempt: jest.fn(),
          },
        },
        {
          provide: FileProcessingStateRepository,
          useValue: {
            transitionToTerminal: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FileProcessingReconcilerService>(FileProcessingReconcilerService);
    dispatcher = module.get<FileProcessingDispatcherService>(FileProcessingDispatcherService);
  });

  describe('reconcileDispatchingAttempts', () => {
    let whereMock: jest.Mock;
    let returningMock: jest.Mock;

    beforeEach(() => {
      returningMock = jest.fn().mockResolvedValue([]);
      const whereMockObj = Object.assign(Promise.resolve([]), { returning: returningMock });
      whereMock = jest.fn().mockReturnValue(whereMockObj);
      const setMock = jest.fn().mockReturnValue({ where: whereMock });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });
    });

    it('should no-op when nothing is expired', async () => {
      (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([]);
      await service.reconcileDispatchingAttempts();
      expect(db.update).not.toHaveBeenCalled();
      expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
    });

    it('should transition to enqueue_pending and trigger dispatcher for expired lease', async () => {
      const attempt = { id: 'attempt-1', dispatchAttempts: 0 };
      (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([attempt]);

      await service.reconcileDispatchingAttempts();

      expect(db.update).toHaveBeenCalled();
      const updateObj = (db.update as jest.Mock).mock.results[0].value;
      expect(updateObj.set).toHaveBeenCalledWith({ status: 'enqueue_pending', dispatchAttempts: 1 });
      expect(dispatcher.dispatchAttempt).toHaveBeenCalledWith('attempt-1');
    });

    it('should handle dispatch_attempt increment', async () => {
      const attempt = { id: 'attempt-2', dispatchAttempts: 2 };
      (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([attempt]);

      await service.reconcileDispatchingAttempts();

      const updateObj = (db.update as jest.Mock).mock.results[0].value;
      expect(updateObj.set).toHaveBeenCalledWith({ status: 'enqueue_pending', dispatchAttempts: 3 });
    });

    it('should transition to enqueue_failed at maximum retry boundary and cascade to files', async () => {
      const attempt = { id: 'attempt-3', fileId: 'file-3', dispatchAttempts: 4 };
      (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([attempt]);
      
      // Simulate successful administrative attempt update (1 row affected)
      returningMock.mockResolvedValue([{ id: attempt.id }]);

      await service.reconcileDispatchingAttempts();

      expect(db.transaction).toHaveBeenCalled();
      
      // Verifying that db.update was called twice within the transaction 
      // (once for attempts, once for files)
      expect(db.update).toHaveBeenCalledTimes(2);
      
      const attemptUpdateObj = (db.update as jest.Mock).mock.results[0].value;
      expect(attemptUpdateObj.set).toHaveBeenCalledWith(expect.objectContaining({ 
        status: 'enqueue_failed',
        dispatchAttempts: 5,
        lastError: 'System failed to queue file for processing',
      }));

      const filesUpdateObj = (db.update as jest.Mock).mock.results[1].value;
      expect(filesUpdateObj.set).toHaveBeenCalledWith(expect.objectContaining({ 
        processingStatus: 'failed', 
      }));
      
      expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
    });

    it('should prevent race conditions by NOT updating files if attempt update matched 0 rows', async () => {
      const attempt = { id: 'attempt-race', fileId: 'file-race', dispatchAttempts: 4 };
      (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([attempt]);
      
      // Simulate race condition: attempt state changed concurrently, so 0 rows returned
      returningMock.mockResolvedValue([]);

      await service.reconcileDispatchingAttempts();

      expect(db.transaction).toHaveBeenCalled();
      
      // Should ONLY update the attempts table, matching 0 rows, and then NOT update files
      expect(db.update).toHaveBeenCalledTimes(1);
      
      const attemptUpdateObj = (db.update as jest.Mock).mock.results[0].value;
      expect(attemptUpdateObj.set).toHaveBeenCalledWith(expect.objectContaining({ 
        status: 'enqueue_failed'
      }));

      expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
    });
  });

  describe('reconcileRetryingAttempts', () => {
    it('should transition eligible retry attempts without dispatching', async () => {
      const setMock = jest.fn().mockReturnValue({ where: jest.fn() });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });

      await service.reconcileRetryingAttempts();

      expect(db.update).toHaveBeenCalled();
      const updateObj = (db.update as jest.Mock).mock.results[0].value;
      expect(updateObj.set).toHaveBeenCalledWith({ status: 'enqueue_pending' });
      expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
    });
  });

  describe('reconcileEnqueuePendingAttempts', () => {
    it('should sweep orphaned enqueue_pending attempts and dispatch them', async () => {
      const pendingAttempt = { id: 'pending-1' };
      (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([pendingAttempt]);

      await service.reconcileEnqueuePendingAttempts();

      expect(dispatcher.dispatchAttempt).toHaveBeenCalledWith('pending-1');
    });
  });
});
