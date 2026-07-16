export interface ConnectorResult<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: Error;
}

export interface ConnectorAdapter {
  authenticate(credentials: any): Promise<ConnectorResult<void>>;
  executeAction(action: string, payload: any): Promise<ConnectorResult<any>>;
  checkHealth(): Promise<ConnectorResult<{ status: 'healthy' | 'unhealthy', latencyMs: number }>>;
  disconnect(): Promise<ConnectorResult<void>>;
}
