export type AnalyticsEventType = 
  | 'assessment.completed'
  | 'revision.completed'
  | 'study.session.completed'
  | 'goal.completed'
  | 'recommendation.accepted'
  | 'recommendation.rejected';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: string;
  payload: any;
}

export class AnalyticsEventStore {
  private events: AnalyticsEvent[] = [];

  append(event: Omit<AnalyticsEvent, 'id'>) {
    this.events.push({
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`
    });
  }

  getEvents(since?: string): readonly AnalyticsEvent[] {
    if (!since) return this.events;
    const sinceDate = new Date(since);
    return this.events.filter(e => new Date(e.timestamp) >= sinceDate);
  }

  getEventsByType(type: AnalyticsEventType): readonly AnalyticsEvent[] {
    return this.events.filter(e => e.type === type);
  }
}
