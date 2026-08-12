import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { LeakReconciliationWorker } from './leak-reconciliation.worker';
import { QuizMonthlyCapacityService } from './quiz-monthly-capacity.service';

@Module({
  imports: [ConfigModule],
  providers: [
    LeakReconciliationWorker,
    QuizMonthlyCapacityService,
    makeHistogramProvider({
      name: 'studyai_quota_worker_duration_seconds',
      help: 'Duration of leak reconciliation sweep in seconds',
    }),
    makeCounterProvider({
      name: 'studyai_quota_worker_batches_total',
      help: 'Total number of HSCAN batches processed',
    }),
    makeCounterProvider({
      name: 'studyai_quota_worker_refunds_total',
      help: 'Total number of expired reservations refunded',
    }),
    makeCounterProvider({
      name: 'studyai_quota_worker_lock_failures_total',
      help: 'Total times leader lock acquisition failed (normal in multi-pod)',
    }),
    makeCounterProvider({
      name: 'studyai_quota_worker_leader_acquired_total',
      help: 'Total times leader lock was successfully acquired',
    }),
    makeCounterProvider({
      name: 'studyai_quota_worker_scan_errors_total',
      help: 'Total number of errors during sweep',
    }),
  ],
  exports: [QuizMonthlyCapacityService],
})
export class QuotaModule {}
