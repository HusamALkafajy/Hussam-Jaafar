import { ILogger, IMetrics, ITracer } from '../contracts';
import { IEventOutbox } from '../../events/outbox';
import { IDomainEvent } from '@studyai/domain';

export class ObservedEventOutbox implements IEventOutbox {
  constructor(
    private readonly inner: IEventOutbox,
    private readonly logger: ILogger,
    private readonly metrics: IMetrics,
    private readonly tracer: ITracer
  ) {}

  async storeEvent(prismaTx: any, event: IDomainEvent): Promise<void> {
    const span = this.tracer.startSpan('EventOutbox.storeEvent', {
      attributes: { 'event.type': event.eventType, 'event.id': event.eventId }
    });

    return this.tracer.withSpan(span, async () => {
      try {
        await this.inner.storeEvent(prismaTx, event);
        this.metrics.incrementCounter('outbox.events.stored', 1, { type: event.eventType });
      } catch (error) {
        this.metrics.incrementCounter('outbox.events.store_error', 1, { type: event.eventType });
        this.logger.error(`Failed to store event in outbox`, error as Error, 'outbox.storeEvent', { eventId: event.eventId });
        throw error;
      }
    });
  }

  async publishPendingEvents(): Promise<void> {
    const span = this.tracer.startSpan('EventOutbox.publishPendingEvents');
    return this.tracer.withSpan(span, async () => {
      const startTime = Date.now();
      try {
        await this.inner.publishPendingEvents();
        const duration = Date.now() - startTime;
        this.metrics.recordTimer('outbox.publish.duration', duration);
      } catch (error) {
        this.metrics.incrementCounter('outbox.publish.error');
        this.logger.error(`Failed to publish pending events`, error as Error, 'outbox.publishPendingEvents');
        throw error;
      }
    });
  }
}
