import { ILogger, IMetrics, ITracer } from '../contracts';
import { IEventDispatcher } from '../../events/dispatcher';
import { IDomainEvent } from '@studyai/domain';

export class ObservedEventDispatcher implements IEventDispatcher {
  constructor(
    private readonly inner: IEventDispatcher,
    private readonly logger: ILogger,
    private readonly metrics: IMetrics,
    private readonly tracer: ITracer
  ) {}

  async dispatch(event: IDomainEvent): Promise<void> {
    const span = this.tracer.startSpan('EventDispatcher.dispatch', {
      attributes: { 'event.type': event.eventType, 'event.id': event.eventId }
    });

    return this.tracer.withSpan(span, async () => {
      try {
        await this.inner.dispatch(event);
        this.metrics.incrementCounter('dispatcher.events.dispatched', 1, { type: event.eventType });
      } catch (error) {
        this.metrics.incrementCounter('dispatcher.events.dispatch_error', 1, { type: event.eventType });
        this.logger.error(`Failed to dispatch event`, error as Error, 'dispatcher.dispatch', { eventId: event.eventId });
        throw error;
      }
    });
  }

  subscribe(eventType: string, handler: (event: IDomainEvent) => Promise<void>): void {
    // Wrap the handler to trace its execution
    const wrappedHandler = async (event: IDomainEvent) => {
      const span = this.tracer.startSpan(`EventHandler.${eventType}`);
      return this.tracer.withSpan(span, async () => {
        try {
          await handler(event);
          this.metrics.incrementCounter('dispatcher.handler.success', 1, { type: eventType });
        } catch (error) {
          this.metrics.incrementCounter('dispatcher.handler.error', 1, { type: eventType });
          throw error;
        }
      });
    };
    
    this.inner.subscribe(eventType, wrappedHandler);
  }
}
