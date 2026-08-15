import { ILogger, IMetrics, ITracer } from '../contracts';
import { IQueue, IJob, QueueEnqueueOptions } from '../../queues/contracts';

export class ObservedQueue implements IQueue {
  constructor(
    private readonly inner: IQueue,
    private readonly queueName: string,
    private readonly logger: ILogger,
    private readonly metrics: IMetrics,
    private readonly tracer: ITracer
  ) {}

  async enqueue(job: IJob, options?: QueueEnqueueOptions): Promise<void> {
    const span = this.tracer.startSpan(`Queue.enqueue`, {
      attributes: { 'queue.name': this.queueName, 'job.type': job.jobType, 'job.id': job.jobId }
    });

    return this.tracer.withSpan(span, async () => {
      try {
        await this.inner.enqueue(job, options);
        this.metrics.incrementCounter('queue.enqueue.success', 1, { queue: this.queueName });
      } catch (error) {
        this.metrics.incrementCounter('queue.enqueue.error', 1, { queue: this.queueName });
        this.logger.error(`Failed to enqueue job`, error as Error, 'queue.enqueue', { jobId: job.jobId, queueName: this.queueName });
        throw error;
      }
    });
  }

  async pause(): Promise<void> {
    this.logger.warn(`Queue paused`, 'queue.pause', { queueName: this.queueName });
    await this.inner.pause();
  }

  async resume(): Promise<void> {
    this.logger.info(`Queue resumed`, 'queue.resume', { queueName: this.queueName });
    await this.inner.resume();
  }

  async close(): Promise<void> {
    this.logger.info(`Queue closed`, 'queue.close', { queueName: this.queueName });
    await this.inner.close();
  }
}
