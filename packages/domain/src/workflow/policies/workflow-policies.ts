export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffFactor: number;
  readonly initialDelayMs: number;
}

export interface TimeoutPolicy {
  readonly timeoutSeconds: number;
}

export interface FailurePolicy {
  readonly continueOnFailure: boolean;
}

export interface CancellationPolicy {
  readonly allowCancellation: boolean;
}

export interface ConcurrencyPolicy {
  readonly maxConcurrentJobs: number;
}
