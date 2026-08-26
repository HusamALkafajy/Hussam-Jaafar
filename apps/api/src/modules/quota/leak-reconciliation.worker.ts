import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TokenAccountant } from '@studyai/domain';
import { IDomainCacheService } from '@studyai/domain/dist/security/quota/ports'; // Actually, since domain exports things, wait, I'll use the proper injection token if applicable.
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class LeakReconciliationWorker {
  private readonly logger = new Logger(LeakReconciliationWorker.name);
  private isScanning = false;
  
  // Expiration threshold: reservations older than 5 minutes are swept
  private readonly TIMEOUT_MS = 5 * 60 * 1000;
  private readonly MAX_EXECUTION_TIME_MS = 45 * 1000;
  private readonly LOCK_KEY = 'worker:leak_reconciliation:lock';

  constructor(
    @Inject('TokenAccountant') private readonly tokenAccountant: TokenAccountant,
    @Inject('IDomainCacheService') private readonly cache: IDomainCacheService,
    private readonly configService: ConfigService,
    
    @InjectMetric('studyai_quota_worker_duration_seconds')
    private readonly durationHistogram: Histogram<string>,
    
    @InjectMetric('studyai_quota_worker_batches_total')
    private readonly batchesTotal: Counter<string>,
    
    @InjectMetric('studyai_quota_worker_refunds_total')
    private readonly refundsTotal: Counter<string>,
    
    @InjectMetric('studyai_quota_worker_lock_failures_total')
    private readonly lockFailuresTotal: Counter<string>,
    
    @InjectMetric('studyai_quota_worker_leader_acquired_total')
    private readonly leaderAcquiredTotal: Counter<string>,
    
    @InjectMetric('studyai_quota_worker_scan_errors_total')
    private readonly scanErrorsTotal: Counter<string>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const mode = this.configService.get<string>('QUOTA_WORKER_MODE') || 'ACTIVE';
    
    if (mode === 'DISABLED') {
      return;
    }

    if (this.isScanning) {
      this.logger.warn('Previous scan still running, skipping this tick.');
      return;
    }

    // Attempt to acquire leader lock via inline Lua
    try {
      const lockAcquired = await this.cache.eval<string | null>(
        "return redis.call('SET', KEYS[1], '1', 'NX', 'EX', 50)",
        [this.LOCK_KEY],
        []
      );

      if (!lockAcquired) {
        this.lockFailuresTotal.inc();
        return; // We lost the election, exit gracefully
      }
    } catch (e) {
      this.scanErrorsTotal.inc();
      this.logger.error('Failed to acquire leader lock due to Redis error', e);
      return;
    }

    this.leaderAcquiredTotal.inc();
    this.isScanning = true;
    const startTime = Date.now();
    const endTimer = this.durationHistogram.startTimer();
    
    let cursor = '0';
    let processed = 0;
    let refunded = 0;

    try {
      this.logger.debug(`Starting leak reconciliation sweep in mode ${mode}`);

      do {
        // Enforce 45-second budget
        if (Date.now() - startTime > this.MAX_EXECUTION_TIME_MS) {
          this.logger.warn('Execution budget exceeded (45s). Yielding remaining work to next Cron tick.');
          break;
        }

        const batch = await this.tokenAccountant.getPendingBatch(cursor, 1000);
        cursor = batch.nextCursor;
        this.batchesTotal.inc();

        for (const item of batch.items) {
          processed++;
          const age = Date.now() - item.payload.timestamp;
          
          if (age > this.TIMEOUT_MS) {
            if (mode === 'ACTIVE') {
              const released = await this.tokenAccountant.release(item.reqId);
              if (released) {
                refunded++;
                this.refundsTotal.inc();
              }
            } else if (mode === 'REPORT_ONLY') {
              this.logger.log(`[REPORT_ONLY] Would release expired reservation reqId=${item.reqId} (age: ${age}ms)`);
            }
          }
        }

        // Yield the event loop between batches
        await new Promise(resolve => setImmediate(resolve));

      } while (cursor !== '0');
      
      this.logger.debug(`Sweep complete. Processed ${processed} items, refunded ${refunded}.`);
    } catch (e) {
      this.scanErrorsTotal.inc();
      this.logger.error('Error during leak reconciliation sweep', e);
    } finally {
      this.isScanning = false;
      endTimer();
    }
  }
}
