import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { IQueue, IJob, QueueEnqueueOptions } from '../contracts';

export class BullQueueAdapter implements IQueue {
  private queue: Queue;

  constructor(
    private readonly queueName: string,
    private readonly redis: Redis
  ) {
    this.queue = new Queue(this.queueName, { connection: this.redis as any });
  }

  async enqueue(job: IJob, options?: QueueEnqueueOptions): Promise<void> {
    await this.queue.add(job.jobType, job, {
      jobId: job.jobId,
      delay: options?.delay,
      priority: job.priority > 0 ? job.priority : undefined,
      attempts: options?.attempts,
      removeOnComplete: options?.removeOnComplete,
      removeOnFail: options?.removeOnFail,
    });
  }

  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  async getJobCounts(): Promise<any> {
    return this.queue.getJobCounts();
  }
}
