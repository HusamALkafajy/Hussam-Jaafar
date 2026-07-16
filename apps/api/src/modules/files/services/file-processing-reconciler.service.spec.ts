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
  },
  eq: jest.fn(),
  and: jest.fn(),
  sql: jest.fn(),
  fileProcessingAttempts: {
    status: 'status',
    dispatchLeaseStartedAt: 'dispatchLeaseStartedAt',
    nextRetryAt: 'nextRetryAt',
    id: 'id'
  }
}));

describe('FileProcessingReconcilerService', () => {
  let service: FileProcessingReconcilerService;
  let dispatcher: FileProcessingDispatcherService;
  let stateRepository: jest.Mocked<FileProcessingStateRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup chainable mock for db.update().set().where().returning()
    const returningMock = jest.fn().mockResolvedValue([]);
    const whereMockObj = Object.assign(Promise.resolve([]), { returning: returningMock });
    const whereMock = jest.fn().mockReturnValue(whereMockObj);
    
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    (db.update as jest.Mock).mockReturnValue({ set: setMock });

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
            transitionToTerminal: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<FileProcessingReconcilerService>(FileProcessingReconcilerService);
    dispatcher = module.get<FileProcessingDispatcherService>(FileProcessingDispatcherService);
    stateRepository = module.get(FileProcessingStateRepository);
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

  it('should transition to enqueue_failed at maximum retry boundary', async () => {
    const attempt = { id: 'attempt-3', fileId: 'file-3', dispatchAttempts: 4 };
    (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([attempt]);

    await service.reconcileDispatchingAttempts();

    expect(stateRepository.transitionToTerminal).toHaveBeenCalledWith(
      'attempt-3',
      'file-3',
      'enqueue_failed',
      { dispatchAttempts: 5 },
      undefined,
      'System failed to queue file for processing'
    );
    expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
  });

  it('should handle repository update correctness and errors', async () => {
    const attempt = { id: 'attempt-4', dispatchAttempts: 1 };
    (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([attempt]);

    // Mock an error during update
    const error = new Error('DB Error');
    const returningMock = jest.fn();
    const whereMockObj = Object.assign(Promise.reject(error), { returning: returningMock });
    const whereMock = jest.fn().mockReturnValue(whereMockObj);
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    (db.update as jest.Mock).mockReturnValue({ set: setMock });

    await expect(service.reconcileDispatchingAttempts()).rejects.toThrow('DB Error');
    expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
  });

  describe('reconcileRetryingAttempts', () => {
    it('should transition eligible retry attempts without dispatching', async () => {
      const setMock = jest.fn().mockReturnValue({ where: jest.fn() });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });

      await service.reconcileRetryingAttempts();

      expect(db.update).toHaveBeenCalled();
      const updateObj = (db.update as jest.Mock).mock.results[0].value;
      expect(updateObj.set).toHaveBeenCalledWith({ status: 'enqueue_pending' });

      // Outbox Pattern: Never dispatch directly from scheduler
      expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
    });

    it('should ignore attempts not yet due (SQL bounds)', async () => {
      const setMock = jest.fn().mockReturnValue({ where: jest.fn() });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });

      await service.reconcileRetryingAttempts();

      expect(db.update).toHaveBeenCalled();
      expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
    });
  });

  describe('reconcileEnqueuePendingAttempts', () => {
    it('should sweep orphaned enqueue_pending attempts and dispatch them', async () => {
      const pendingAttempt = { id: 'pending-1' };
      (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([pendingAttempt]);

      await service.reconcileEnqueuePendingAttempts();

      expect(dispatcher.dispatchAttempt).toHaveBeenCalledWith('pending-1');
      expect(db.update).not.toHaveBeenCalled(); // Dispatcher handles DB transition
    });

    it('should no-op when no orphaned attempts exist', async () => {
      (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([]);

      await service.reconcileEnqueuePendingAttempts();

      expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
    });
  });
});
