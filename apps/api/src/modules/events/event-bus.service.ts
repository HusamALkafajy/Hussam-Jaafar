import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { DomainEvent } from './domain-event';

export interface IEventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(eventName: string, handler: (event: T) => Promise<void>): void;
  unsubscribe(eventName: string, handlerId: any): void;
}

@Injectable()
export class EventBusService implements IEventBus {
  private readonly logger = new Logger(EventBusService.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    // Increase limit if many listeners are attached (e.g., > 10)
    this.emitter.setMaxListeners(20);
  }

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    this.logger.log(`Publishing domain event [${event.eventName}] (Aggregate: ${event.aggregateId})`);
    
    // In-memory emit. We await a microtask to decouple execution frame slightly,
    // though native emit is synchronous.
    // Note: This is an in-memory process-local adapter for Phase 11.1
    // It does not guarantee cross-process delivery, DLQ, or durable retries.
    queueMicrotask(() => {
      try {
        this.emitter.emit(event.eventName, event);
      } catch (err) {
        this.logger.error(`Error emitting event ${event.eventName}`, err);
      }
    });
  }

  subscribe<T extends DomainEvent>(eventName: string, handler: (event: T) => Promise<void>): void {
    this.logger.debug(`Subscribing to domain event [${eventName}]`);
    this.emitter.on(eventName, async (event: T) => {
      try {
        await handler(event);
      } catch (err) {
        this.logger.error(`Error handling event ${eventName}`, err);
      }
    });
  }

  unsubscribe(eventName: string, handler: any): void {
    this.emitter.removeListener(eventName, handler);
  }
}
