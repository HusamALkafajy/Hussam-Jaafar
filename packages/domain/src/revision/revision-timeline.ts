export type RevisionEventType = 
  | 'revision.started' 
  | 'revision.completed' 
  | 'item.reviewed' 
  | 'item.postponed' 
  | 'item.skipped' 
  | 'memory.updated';

export interface RevisionEvent {
  id: string;
  type: RevisionEventType;
  timestamp: string;
  payload?: any;
}

export class RevisionTimeline {
  private events: RevisionEvent[] = [];

  append(type: RevisionEventType, payload?: any) {
    this.events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type,
      timestamp: new Date().toISOString(),
      payload
    });
  }

  getEvents(): readonly RevisionEvent[] {
    return this.events;
  }
}
