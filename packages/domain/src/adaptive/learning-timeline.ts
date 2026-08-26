export type TimelineEventType = 
  | 'asset.reviewed' 
  | 'asset.completed' 
  | 'goal.completed' 
  | 'session.started' 
  | 'session.completed' 
  | 'recommendation.accepted';

export interface TimelineEvent {
  readonly id: string;
  readonly type: TimelineEventType;
  readonly timestamp: string;
  readonly payload: Record<string, any>;
  readonly sourceContextId?: string;
}

export class LearningTimeline {
  private _events: TimelineEvent[] = [];

  constructor(initialEvents: TimelineEvent[] = []) {
    this._events = [...initialEvents];
  }

  append(event: TimelineEvent): void {
    // Timeline is append-only
    this._events.push(event);
  }

  get events(): ReadonlyArray<TimelineEvent> {
    return this._events;
  }
}
