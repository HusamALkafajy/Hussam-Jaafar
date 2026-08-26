import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '../../prisma-client';
import { IWorker, IJob } from '../contracts';
import { IWorkerRegistry } from '../../workers/registry';
import { WorkerExecutionContext } from '../../workers/context';
import { ILeaseManager } from '../../workers/lease';

export class BullWorkerAdapter implements IWorker {
  private worker?: Worker;

  constructor(
    private readonly queueName: string,
    private readonly workerName: string,
    private readonly workerId: string,
    private readonly redis: Redis,
    private readonly prisma: PrismaClient,
    private readonly registry: IWorkerRegistry,
    private readonly leaseManager: ILeaseManager
  ) {}

  async start(): Promise<void> {
    const capabilities = this.registry.getCapabilities(this.workerName);
    
    this.worker = new Worker(this.queueName, async (bullJob: Job) => {
      const jobData = bullJob.data as IJob;
      
      // 1. Acquire Lease
      const leaseAcquired = await this.leaseManager.acquireLease(this.workerId);
      if (!leaseAcquired) {
        throw new Error('Failed to acquire lease for execution');
      }

      await this.updateHistoryStatus(jobData.jobId, 'RUNNING');
      await this.prisma.workerRuntime.update({
        where: { workerId: this.workerId },
        data: { currentJobId: jobData.jobId, status: 'PROCESSING' }
      });
      
      try {
        const handler = this.registry.getHandler(this.workerName, jobData.jobType);
        if (!handler) {
          throw new Error(`No handler registered for job type: ${jobData.jobType}`);
        }

        const executionContext: WorkerExecutionContext = {
          jobId: jobData.jobId,
          correlationId: jobData.correlationId,
          causationId: jobData.causationId,
          traceId: jobData.traceId,
          attempt: bullJob.attemptsMade + 1,
          queueName: this.queueName,
          workerId: this.workerId,
          leaseId: this.workerId, // In this model, lease is tied to worker
          payload: jobData.payload
        };

        // Ensure execution
        await handler.handle(executionContext);
        
        await this.updateHistoryStatus(jobData.jobId, 'COMPLETED');
        await this.prisma.workerRuntime.update({
          where: { workerId: this.workerId },
          data: { processedJobs: { increment: 1 }, currentJobId: null, status: 'IDLE' }
        });
        
      } catch (error: any) {
        const isDeadLetter = bullJob.attemptsMade >= (bullJob.opts.attempts || 1);
        await this.updateHistoryStatus(
          jobData.jobId, 
          isDeadLetter ? 'DEAD_LETTER' : 'FAILED', 
          error.message
        );
        await this.prisma.workerRuntime.update({
          where: { workerId: this.workerId },
          data: { failedJobs: { increment: 1 }, currentJobId: null, status: 'IDLE' }
        });
        throw error;
      }
    }, { 
      connection: this.redis as any,
      concurrency: capabilities?.maxConcurrency || 5 
    });

    this.worker.on('failed', (job, err) => {});
  }

  private async updateHistoryStatus(jobId: string, status: any, errorMessage?: string): Promise<void> {
    try {
      const data: any = { 
        status, 
        updatedAt: new Date() 
      };
      
      if (status === 'RUNNING') data.startedAt = new Date();
      if (status === 'COMPLETED') data.completedAt = new Date();
      if (status === 'FAILED' || status === 'DEAD_LETTER') {
        data.failedAt = new Date();
        data.errorMessage = errorMessage;
        data.attempts = { increment: 1 };
      }

      await this.prisma.jobExecution.update({
        where: { jobId },
        data
      });
    } catch (err) {
      // Ignore if job doesn't exist in history yet, though Outbox->Dispatcher creates it.
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
