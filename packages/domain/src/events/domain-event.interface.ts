export interface IDomainEvent<TPayload = any> {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  timestamp: Date;
  version: number;
  payload: TPayload;
  metadata?: Record<string, any>;
}

export abstract class DomainEvent<TPayload = any> implements IDomainEvent<TPayload> {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly eventType: string;
  public readonly timestamp: Date;
  public readonly version: number;
  public readonly payload: TPayload;
  public readonly metadata?: Record<string, any>;

  constructor(params: {
    eventId?: string;
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    timestamp?: Date;
    version?: number;
    payload: TPayload;
    metadata?: Record<string, any>;
  }) {
    this.eventId = params.eventId || crypto.randomUUID();
    this.aggregateId = params.aggregateId;
    this.aggregateType = params.aggregateType;
    this.eventType = params.eventType;
    this.timestamp = params.timestamp || new Date();
    this.version = params.version || 1;
    this.payload = params.payload;
    this.metadata = params.metadata;
  }
}
