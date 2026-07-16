import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LeakReconciliationWorker } from './leak-reconciliation.worker';
import { TokenAccountant } from '@studyai/domain';
import { IDomainCacheService } from '@studyai/domain/dist/security/quota/ports';
import { getToken } from '@willsoto/nestjs-prometheus';

describe('LeakReconciliationWorker', () => {
  let worker: LeakReconciliationWorker;
  let tokenAccountant: jest.Mocked<TokenAccountant>;
  let cacheService: jest.Mocked<IDomainCacheService>;
  let configService: jest.Mocked<ConfigService>;
  let mockEndTimer: jest.Mock;

  const mockCounter = { inc: jest.fn() };
  mockEndTimer = jest.fn();
  const mockHistogram = { startTimer: jest.fn().mockReturnValue(mockEndTimer) };

  beforeEach(async () => {
    tokenAccountant = {
      getPendingBatch: jest.fn(),
      release: jest.fn(),
    } as unknown as jest.Mocked<TokenAccountant>;

    cacheService = {
      eval: jest.fn(),
    } as unknown as jest.Mocked<IDomainCacheService>;

    configService = {
      get: jest.fn().mockReturnValue('ACTIVE'),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeakReconciliationWorker,
        { provide: 'TokenAccountant', useValue: tokenAccountant },
        { provide: 'IDomainCacheService', useValue: cacheService },
        { provide: ConfigService, useValue: configService },
        { provide: getToken('studyai_quota_worker_duration_seconds'), useValue: mockHistogram },
        { provide: getToken('studyai_quota_worker_batches_total'), useValue: mockCounter },
        { provide: getToken('studyai_quota_worker_refunds_total'), useValue: mockCounter },
        { provide: getToken('studyai_quota_worker_lock_failures_total'), useValue: mockCounter },
        { provide: getToken('studyai_quota_worker_leader_acquired_total'), useValue: mockCounter },
        { provide: getToken('studyai_quota_worker_scan_errors_total'), useValue: mockCounter },
      ],
    }).compile();

    worker = module.get<LeakReconciliationWorker>(LeakReconciliationWorker);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  it('exits if mode is DISABLED', async () => {
    configService.get.mockReturnValue('DISABLED');
    await worker.handleCron();
    expect(cacheService.eval).not.toHaveBeenCalled();
  });

  it('exits if lock acquisition fails', async () => {
    cacheService.eval.mockResolvedValue(null);
    await worker.handleCron();
    expect(tokenAccountant.getPendingBatch).not.toHaveBeenCalled();
    expect(mockCounter.inc).toHaveBeenCalled(); // lockFailuresTotal
  });

  it('sweeps and releases expired items in ACTIVE mode', async () => {
    cacheService.eval.mockResolvedValue('OK');
    const expiredTimestamp = Date.now() - 6 * 60 * 1000; // 6 mins ago
    const freshTimestamp = Date.now() - 1 * 60 * 1000; // 1 min ago
    
    tokenAccountant.getPendingBatch.mockResolvedValueOnce({
      nextCursor: '0',
      items: [
        { reqId: 'req1', payload: { userId: 'u1', cost: 10, timestamp: expiredTimestamp } },
        { reqId: 'req2', payload: { userId: 'u2', cost: 10, timestamp: freshTimestamp } },
      ]
    });
    tokenAccountant.release.mockResolvedValue(true);

    await worker.handleCron();

    expect(tokenAccountant.getPendingBatch).toHaveBeenCalledWith('0', 1000);
    expect(tokenAccountant.release).toHaveBeenCalledTimes(1);
    expect(tokenAccountant.release).toHaveBeenCalledWith('req1');
    expect(mockCounter.inc).toHaveBeenCalled(); // refundsTotal
    expect(mockEndTimer).toHaveBeenCalled();
  });

  it('sweeps but does not release in REPORT_ONLY mode', async () => {
    configService.get.mockReturnValue('REPORT_ONLY');
    cacheService.eval.mockResolvedValue('OK');
    const expiredTimestamp = Date.now() - 6 * 60 * 1000;
    
    tokenAccountant.getPendingBatch.mockResolvedValueOnce({
      nextCursor: '0',
      items: [
        { reqId: 'req1', payload: { userId: 'u1', cost: 10, timestamp: expiredTimestamp } },
      ]
    });

    await worker.handleCron();

    expect(tokenAccountant.getPendingBatch).toHaveBeenCalled();
    expect(tokenAccountant.release).not.toHaveBeenCalled();
  });

  it('yields and breaks execution after 45 seconds', async () => {
    cacheService.eval.mockResolvedValue('OK');
    
    tokenAccountant.getPendingBatch.mockImplementation(async () => {
      // Fake time taking long
      jest.spyOn(Date, 'now').mockReturnValueOnce(Date.now() + 50000);
      return {
        nextCursor: '1',
        items: []
      };
    });

    await worker.handleCron();
    
    // Should have only called it once because time exceeded
    expect(tokenAccountant.getPendingBatch).toHaveBeenCalledTimes(1);
  });
});
