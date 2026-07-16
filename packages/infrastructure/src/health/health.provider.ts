export interface HealthStatus {
  service: string;
  status: 'UP' | 'DOWN';
  latencyMs: number;
}

export interface IHealthProvider {
  checkDatabase(): Promise<HealthStatus>;
  checkQueue(): Promise<HealthStatus>;
  checkWorkerRuntime(): Promise<HealthStatus>;
  checkOutbox(): Promise<HealthStatus>;
  checkEventDispatcher(): Promise<HealthStatus>;
  checkCache(): Promise<HealthStatus>;
}
