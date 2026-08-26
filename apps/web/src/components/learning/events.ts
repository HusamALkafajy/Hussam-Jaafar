import { InternalEvent, InternalEventName } from '../../mocks/workspace/events';

type EventHandler = (event: InternalEvent) => void;

class EventBus {
  private listeners: Map<InternalEventName, Set<EventHandler>> = new Map();

  subscribe(name: InternalEventName, handler: EventHandler): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    this.listeners.get(name)!.add(handler);

    return () => {
      this.listeners.get(name)?.delete(handler);
    };
  }

  publish(name: InternalEventName, payload: any): void {
    const event: InternalEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      timestamp: new Date().toISOString(),
      payload
    };

    if (this.listeners.has(name)) {
      this.listeners.get(name)!.forEach(handler => {
        try {
          handler(event);
        } catch (e) {
          console.error(`Error in event handler for ${name}:`, e);
        }
      });
    }
  }
}

export const internalEvents = new EventBus();
