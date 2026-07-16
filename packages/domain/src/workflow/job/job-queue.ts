import { JobInstance } from './job-instance';

export class JobQueue {
  private queue: JobInstance[] = [];

  enqueue(job: JobInstance) {
    if (job.status !== 'Queued') throw new Error('Only Queued jobs can be enqueued');
    this.queue.push(job);
  }

  dequeue(): JobInstance | undefined {
    return this.queue.shift();
  }

  get length() {
    return this.queue.length;
  }
}
