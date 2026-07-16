import { IDomainEvent } from '@studyai/domain';

export interface IJob<TPayload = any> {
  jobId: string;
  jobType: string;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  priority: number;
  payload: TPayload;
}

export interface IQueue {
  enqueue(job: IJob, options?: { delay?: number }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  close(): Promise<void>;
  getJobCounts?(): Promise<any>;
}

export interface IWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface IJobHandler<TPayload = any> {
  handle(job: IJob<TPayload>): Promise<void>;
}

export interface IJobDispatcher {
  dispatch(event: IDomainEvent): Promise<void>;
}

export interface IJobScheduler {
  schedule(job: IJob, cron: string): Promise<void>;
}

export interface IRetryStrategy {
  attempts: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

export interface IDeadLetterQueue {
  moveToDeadLetter(jobId: string, reason: string): Promise<void>;
}
