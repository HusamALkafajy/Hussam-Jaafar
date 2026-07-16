export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  payload: any;
  timestamp: string;
}

export interface IEventStoreProvider {
  append(event: DomainEvent): Promise<void>;
  getEventsForAggregate(aggregateId: string): Promise<DomainEvent[]>;
}
