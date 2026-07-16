export interface ILeasePolicy {
  getLeaseDurationMs(): number;
  getRenewalIntervalMs(): number;
}

export interface IHeartbeatPolicy {
  getHeartbeatIntervalMs(): number;
}

export interface IConcurrencyPolicy {
  getMaxConcurrency(): number;
}

export interface IRetryPolicy {
  getMaxAttempts(): number;
  getBackoffMs(attempt: number): number;
}

export interface ITimeoutPolicy {
  getExecutionTimeoutMs(): number;
}

// Default Implementations
export class DefaultLeasePolicy implements ILeasePolicy {
  getLeaseDurationMs() { return 30000; } // 30 seconds
  getRenewalIntervalMs() { return 10000; } // 10 seconds
}

export class DefaultHeartbeatPolicy implements IHeartbeatPolicy {
  getHeartbeatIntervalMs() { return 10000; } // 10 seconds (aligned with lease renewal)
}

export class DefaultConcurrencyPolicy implements IConcurrencyPolicy {
  getMaxConcurrency() { return 5; }
}

export class DefaultRetryPolicy implements IRetryPolicy {
  getMaxAttempts() { return 3; }
  getBackoffMs(attempt: number) { return Math.pow(2, attempt) * 1000; }
}

export class DefaultTimeoutPolicy implements ITimeoutPolicy {
  getExecutionTimeoutMs() { return 60000; } // 60 seconds
}
