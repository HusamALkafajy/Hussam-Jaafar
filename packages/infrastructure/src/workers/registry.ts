import { WorkerExecutionContext } from './context';

export interface IApplicationHandler<TPayload = any> {
  handle(context: WorkerExecutionContext<TPayload>): Promise<void>;
}

export interface WorkerCapabilities {
  supportedJobTypes: string[];
  maxConcurrency: number;
  priority: number;
  queues: string[];
}

export interface IWorkerRegistry {
  register(workerName: string, capabilities: WorkerCapabilities, handlers: Map<string, IApplicationHandler>): void;
  getCapabilities(workerName: string): WorkerCapabilities | undefined;
  getHandler(workerName: string, jobType: string): IApplicationHandler | undefined;
  getAllWorkers(): string[];
}

export class InMemoryWorkerRegistry implements IWorkerRegistry {
  private capabilities = new Map<string, WorkerCapabilities>();
  private handlers = new Map<string, Map<string, IApplicationHandler>>();

  register(workerName: string, capabilities: WorkerCapabilities, workerHandlers: Map<string, IApplicationHandler>): void {
    this.capabilities.set(workerName, capabilities);
    this.handlers.set(workerName, workerHandlers);
  }

  getCapabilities(workerName: string): WorkerCapabilities | undefined {
    return this.capabilities.get(workerName);
  }

  getHandler(workerName: string, jobType: string): IApplicationHandler | undefined {
    const workerHandlers = this.handlers.get(workerName);
    return workerHandlers?.get(jobType);
  }

  getAllWorkers(): string[] {
    return Array.from(this.capabilities.keys());
  }
}
