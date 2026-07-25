export interface DomainEvent<TPayload = any> {
  eventId: string;           // Unique identifier for the event (UUID v4)
  eventName: string;         // Canonical name (e.g., 'KnowledgeGraphBuilt')
  aggregateId: string;       // ID of the root aggregate (e.g., File ID)
  aggregateType: string;     // Type of aggregate (e.g., 'File', 'StudySession')
  eventVersion: number;      // Version of the event schema (e.g., 1)
  occurredAt: Date;          // UTC timestamp of the event occurrence
  correlationId?: string;    // Trace ID connecting a chain of events/actions
  causationId?: string;      // ID of the command or previous event that caused this event
  payload: TPayload;         // The strongly-typed event-specific data
  metadata?: Record<string, any>; // Optional contextual data (e.g., userId, tenantId)
}

export class KnowledgeGraphBuiltEvent implements DomainEvent<{ graphVersion: string, fileId: string }> {
  eventName = 'KnowledgeGraphBuilt';
  aggregateType = 'File';
  eventVersion = 1;
  occurredAt = new Date();

  constructor(
    public eventId: string,
    public aggregateId: string,
    public payload: { graphVersion: string, fileId: string }
  ) {}
}

export class KnowledgeGraphPersistedEvent implements DomainEvent<{ fileId: string, nodeCount: number, edgeCount: number }> {
  eventName = 'KnowledgeGraphPersisted';
  aggregateType = 'File';
  eventVersion = 1;
  occurredAt = new Date();

  constructor(
    public eventId: string,
    public aggregateId: string,
    public payload: { fileId: string, nodeCount: number, edgeCount: number }
  ) {}
}

export class QuizGeneratedEvent implements DomainEvent<{ quizId: string, fileId: string }> {
  eventName = 'QuizGenerated';
  aggregateType = 'Exam';
  eventVersion = 1;
  occurredAt = new Date();

  constructor(
    public eventId: string,
    public aggregateId: string,
    public payload: { quizId: string, fileId: string }
  ) {}
}
