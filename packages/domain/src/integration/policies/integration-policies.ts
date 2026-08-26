export interface RetryPolicy {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
}

export interface RateLimitPolicy {
  readonly maxRequestsPerMinute: number;
}

export interface AuthenticationPolicy {
  readonly requiredScopes: string[];
  readonly tokenRefreshStrategy: 'Auto' | 'Manual';
}

export interface TimeoutPolicy {
  readonly timeoutMs: number;
}

export interface SynchronizationPolicy {
  readonly conflictResolution: 'SourceWins' | 'TargetWins' | 'Manual';
}

export interface ErrorHandlingPolicy {
  readonly circuitBreakerThreshold: number;
}
