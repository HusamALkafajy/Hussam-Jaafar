export interface ILogContext {
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  spanId?: string;
  workerId?: string;
  jobId?: string;
  workflowId?: string;
  aggregateId?: string;
  component?: string;
  environment?: string;
  version?: string;
  [key: string]: any;
}

export interface ILogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  operation?: string;
  durationMs?: number;
  error?: Error;
  context: ILogContext;
}

export interface ILogger {
  info(message: string, operation?: string, additionalContext?: Partial<ILogContext>): void;
  warn(message: string, operation?: string, additionalContext?: Partial<ILogContext>): void;
  error(message: string, error?: Error, operation?: string, additionalContext?: Partial<ILogContext>): void;
  debug(message: string, operation?: string, additionalContext?: Partial<ILogContext>): void;
  withContext(context: Partial<ILogContext>): ILogger;
}

export interface IMetrics {
  incrementCounter(name: string, value?: number, tags?: Record<string, string>): void;
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
  recordTimer(name: string, durationMs: number, tags?: Record<string, string>): void;
  setGauge(name: string, value: number, tags?: Record<string, string>): void;
}

export interface ISpan {
  spanId: string;
  traceId: string;
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: Record<string, any>): void;
  end(): void;
  recordException(error: Error): void;
}

export interface ITracer {
  startSpan(name: string, options?: { parentSpanId?: string, attributes?: Record<string, any> }): ISpan;
  withSpan<T>(span: ISpan, fn: () => Promise<T>): Promise<T>;
}
