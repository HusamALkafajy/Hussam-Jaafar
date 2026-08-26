import { ILogger, IMetrics, ITracer, ILogContext, ISpan } from './contracts';
import { CorrelationContextManager } from './correlation';
import { randomUUID } from 'crypto';

export class ConsoleLogger implements ILogger {
  constructor(private readonly defaultContext: Partial<ILogContext> = {}) {}

  private formatMessage(level: string, message: string, operation?: string, context?: Partial<ILogContext>, error?: Error) {
    const correlation = CorrelationContextManager.getContext();
    const mergedContext = { ...this.defaultContext, ...correlation, ...context };
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      operation,
      context: mergedContext,
      error: error?.stack
    };
    return JSON.stringify(entry);
  }

  info(message: string, operation?: string, context?: Partial<ILogContext>) {
    console.log(this.formatMessage('info', message, operation, context));
  }
  warn(message: string, operation?: string, context?: Partial<ILogContext>) {
    console.warn(this.formatMessage('warn', message, operation, context));
  }
  error(message: string, error?: Error, operation?: string, context?: Partial<ILogContext>) {
    console.error(this.formatMessage('error', message, operation, context, error));
  }
  debug(message: string, operation?: string, context?: Partial<ILogContext>) {
    console.debug(this.formatMessage('debug', message, operation, context));
  }

  withContext(context: Partial<ILogContext>): ILogger {
    return new ConsoleLogger({ ...this.defaultContext, ...context });
  }
}

export class InMemoryMetrics implements IMetrics {
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>) {}
  recordHistogram(name: string, value: number, tags?: Record<string, string>) {}
  recordTimer(name: string, durationMs: number, tags?: Record<string, string>) {}
  setGauge(name: string, value: number, tags?: Record<string, string>) {}
}

export class DummySpan implements ISpan {
  public readonly spanId = randomUUID();
  constructor(public readonly traceId: string) {}
  setAttribute(key: string, value: string | number | boolean) {}
  addEvent(name: string, attributes?: Record<string, any>) {}
  end() {}
  recordException(error: Error) {}
}

export class DummyTracer implements ITracer {
  startSpan(name: string, options?: { parentSpanId?: string, attributes?: Record<string, any> }): ISpan {
    const traceId = CorrelationContextManager.getContext().traceId || randomUUID();
    return new DummySpan(traceId);
  }
  
  async withSpan<T>(span: ISpan, fn: () => Promise<T>): Promise<T> {
    try {
      return await CorrelationContextManager.runWithContext({ traceId: span.traceId, spanId: span.spanId }, fn);
    } catch (e) {
      span.recordException(e as Error);
      throw e;
    } finally {
      span.end();
    }
  }
}
