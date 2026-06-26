import { Test, TestingModule } from '@nestjs/testing';
import { FileProcessingReconcilerService } from './file-processing-reconciler.service';
import { FileProcessingDispatcherService } from './file-processing-dispatcher.service';
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
    id: 'id'
  }
}));

describe('FileProcessingReconcilerService', () => {
  let service: FileProcessingReconcilerService;
  let dispatcher: FileProcessingDispatcherService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup chainable mock for db.update().set().where()
    const whereMock = jest.fn().mockResolvedValue([]);
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
      ],
    }).compile();

    service = module.get<FileProcessingReconcilerService>(FileProcessingReconcilerService);
    dispatcher = module.get<FileProcessingDispatcherService>(FileProcessingDispatcherService);
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
    const attempt = { id: 'attempt-3', dispatchAttempts: 4 };
    (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([attempt]);

    await service.reconcileDispatchingAttempts();

    const updateObj = (db.update as jest.Mock).mock.results[0].value;
    expect(updateObj.set).toHaveBeenCalledWith({ status: 'enqueue_failed', dispatchAttempts: 5 });
    expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
  });

  it('should handle repository update correctness and errors', async () => {
    const attempt = { id: 'attempt-4', dispatchAttempts: 1 };
    (db.query.fileProcessingAttempts.findMany as jest.Mock).mockResolvedValue([attempt]);

    // Mock an error during update
    const error = new Error('DB Error');
    const setMock = jest.fn().mockReturnValue({ where: jest.fn().mockRejectedValue(error) });
    (db.update as jest.Mock).mockReturnValue({ set: setMock });

    await expect(service.reconcileDispatchingAttempts()).rejects.toThrow('DB Error');
    expect(dispatcher.dispatchAttempt).not.toHaveBeenCalled();
  });
});
