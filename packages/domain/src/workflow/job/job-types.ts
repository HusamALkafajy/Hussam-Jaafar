export type JobStatus = 
  | 'Queued'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'
  | 'TimedOut';

export interface JobDefinition {
  readonly id: string;
  readonly name: string;
  readonly defaultTimeoutSeconds?: number;
  readonly defaultRetries?: number;
}

export interface JobResult {
  readonly success: boolean;
  readonly outputPayload?: any;
  readonly errorPayload?: any;
  readonly durationSeconds: number;
}

export interface JobHistoryEvent {
  readonly status: JobStatus;
  readonly timestamp: string;
}
