import { EventEmitter } from 'events';
import { IDomainEvent } from '@studyai/domain';

export interface IEventDispatcher {
  dispatch(event: IDomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: IDomainEvent) => Promise<void>): void;
}

export class InProcessEventDispatcher implements IEventDispatcher {
  private readonly bus: EventEmitter;

  constructor() {
    this.bus = new EventEmitter();
    this.bus.setMaxListeners(100);
  }

  async dispatch(event: IDomainEvent): Promise<void> {
    // In an in-process dispatcher, we map eventType to handlers
    const listeners = this.bus.listeners(event.eventType);
    
    if (listeners.length === 0) {
      // Dead-letter or ignore if no subscribers
      return;
    }

    // Execute all subscribers concurrently
    await Promise.all(
      listeners.map(handler => handler(event))
    );
  }

  subscribe(eventType: string, handler: (event: IDomainEvent) => Promise<void>): void {
    this.bus.on(eventType, handler);
  }
}
