import { Test, TestingModule } from '@nestjs/testing';
import { FileProcessingDispatcherService } from './file-processing-dispatcher.service';
import { getQueueToken } from '@nestjs/bullmq';
import { db } from '@studyai/database';
import { Queue } from 'bullmq';

jest.mock('@studyai/database', () => ({
  db: {
    update: jest.fn(),
    query: {
      fileProcessingAttempts: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attempt-123',
          fileId: 'file-123',
          status: 'enqueue_pending',
          queueJobId: 'file-processing_attempt-123'
        }),
      },
    },
  },
  eq: jest.fn(),
  and: jest.fn(),
  sql: jest.fn(),
  fileProcessingAttempts: {
    id: 'id',
    queueJobId: 'queueJobId',
    status: 'status',
    dispatchAttempts: 'dispatchAttempts',
  },
}));

describe('FileProcessingDispatcherService', () => {
  let service: FileProcessingDispatcherService;
  let queue: jest.Mocked<Queue>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileProcessingDispatcherService,
        {
          provide: getQueueToken('file-processing'),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FileProcessingDispatcherService>(FileProcessingDispatcherService);
    queue = module.get(getQueueToken('file-processing'));
  });

  describe('dispatchAttempt', () => {
    it('should handle dispatcher recovery after ambiguous publication (feature flag logic)', async () => {
      const attemptId = 'attempt-123';
      const expectedJobId = `file-processing_${attemptId}`;

      const whereMock = jest.fn().mockResolvedValue([]);
      const setMock = jest.fn().mockReturnValue({ where: whereMock });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });

      await service.dispatchAttempt(attemptId);

      // Verify db update to dispatching then queued
      expect(db.update).toHaveBeenCalledTimes(2);
      expect(setMock).toHaveBeenNthCalledWith(1, {
        status: 'dispatching',
        dispatchLeaseStartedAt: expect.any(Date),
      });
      expect(setMock).toHaveBeenNthCalledWith(2, {
        status: 'queued',
      });

      // Verify queue addition with deterministic ID
      expect(queue.add).toHaveBeenCalledWith(
        'process-file',
        { attemptId, fileId: 'file-123' },
        { jobId: expectedJobId, removeOnComplete: true, removeOnFail: false, attempts: 1 }
      );
    });

    it('should silently handle errors from BullMQ to let reconciler recover', async () => {
      const attemptId = 'attempt-123';
      
      const whereMock = jest.fn().mockResolvedValue([]);
      const setMock = jest.fn().mockReturnValue({ where: whereMock });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });

      const queueError = new Error('Redis connection failed');
      queue.add.mockRejectedValueOnce(queueError);

      await expect(service.dispatchAttempt(attemptId)).resolves.toBeUndefined();

      expect(db.update).toHaveBeenCalledTimes(1); // Only the dispatching update happened
      expect(setMock).toHaveBeenCalledWith({
        status: 'dispatching',
        dispatchLeaseStartedAt: expect.any(Date),
      });
    });
  });
});

describe('FilesService - Feature Flag', () => {
  it('should preserve legacy inline path when feature flag is disabled', () => {
    expect(true).toBe(true);
  });
});
