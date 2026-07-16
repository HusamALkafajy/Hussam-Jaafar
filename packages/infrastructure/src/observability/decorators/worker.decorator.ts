import { ILogger, IMetrics, ITracer } from '../contracts';
import { IApplicationHandler, WorkerExecutionContext } from '../../workers';

export class ObservedWorkerHandler<TPayload> implements IApplicationHandler<TPayload> {
  constructor(
    private readonly inner: IApplicationHandler<TPayload>,
    private readonly jobType: string,
    private readonly logger: ILogger,
    private readonly metrics: IMetrics,
    private readonly tracer: ITracer
  ) {}

  async handle(context: WorkerExecutionContext<TPayload>): Promise<void> {
    const span = this.tracer.startSpan(`WorkerHandler.${this.jobType}`, {
      attributes: { 
        'job.id': context.jobId,
        'worker.id': context.workerId,
        'queue.name': context.queueName
      }
    });

    // Populate the correlation context with incoming metadata
    const logContext = {
      jobId: context.jobId,
      workerId: context.workerId,
      correlationId: context.correlationId,
      causationId: context.causationId,
      traceId: context.traceId
    };

    return this.tracer.withSpan(span, async () => {
      const startTime = Date.now();
      try {
        await this.inner.handle(context);
        const duration = Date.now() - startTime;
        
        this.metrics.recordTimer('worker.job.duration', duration, { jobType: this.jobType });
        this.metrics.incrementCounter('worker.job.success', 1, { jobType: this.jobType });
        this.logger.info(`Job processed successfully`, 'worker.handle', logContext);
      } catch (error) {
        this.metrics.incrementCounter('worker.job.error', 1, { jobType: this.jobType });
        this.logger.error(`Failed to process job`, error as Error, 'worker.handle', logContext);
        throw error;
      }
    });
  }
}
