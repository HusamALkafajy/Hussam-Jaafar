import { AsyncLocalStorage } from 'async_hooks';
import { ILogContext } from './contracts';

export class CorrelationContextManager {
  private static storage = new AsyncLocalStorage<Partial<ILogContext>>();

  static runWithContext<T>(context: Partial<ILogContext>, fn: () => T | Promise<T>): T | Promise<T> {
    const existing = this.storage.getStore() || {};
    const merged = { ...existing, ...context };
    return this.storage.run(merged, fn);
  }

  static getContext(): Partial<ILogContext> {
    return this.storage.getStore() || {};
  }
}
