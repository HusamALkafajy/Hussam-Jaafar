import { IQueue } from '../queues/contracts';

export interface WorkerExecutionContext<TPayload = any> {
  jobId: string;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  attempt: number;
  queueName: string;
  workerId: string;
  leaseId: string;
  payload: TPayload;
}
