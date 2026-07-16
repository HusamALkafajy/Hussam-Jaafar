export interface WorkerHealthView {
  workerId: string;
  workerName: string;
  status: string;
  isAlive: boolean;
  activeJobs: number;
  processedJobs: number;
  failedJobs: number;
  averageDurationMs: number;
  lastHeartbeat: Date;
  leaseExpiration: Date;
}

export interface QueueHealthView {
  queueName: string;
  waitingJobs: number;
  activeJobs: number;
  failedJobs: number;
  delayedJobs: number;
}

export interface OutboxHealthView {
  pendingEvents: number;
  oldestPendingEventAgeMs: number;
  failedEvents: number;
}

export interface ApplicationHealthView {
  status: 'UP' | 'DEGRADED' | 'DOWN';
  uptimeMs: number;
  version: string;
  components: {
    database: 'UP' | 'DOWN';
    cache: 'UP' | 'DOWN';
    queue: 'UP' | 'DOWN';
  };
}

export interface RepositoryMetricsView {
  repositoryName: string;
  totalOperations: number;
  averageLatencyMs: number;
  errorRate: number;
}
