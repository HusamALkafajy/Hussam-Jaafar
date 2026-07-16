import { AnalyticsEventStore, AnalyticsEvent } from './analytics-event-store';

export interface AssessmentActivityProjection {
  totalAssessments: number;
  averageAccuracy: number;
  completedAtDates: string[];
}

export interface RevisionActivityProjection {
  totalRevisions: number;
  averageAccuracy: number;
  totalDurationSeconds: number;
  retentionTransitions: any[];
}

export interface StudyTimeProjection {
  totalStudyTimeSeconds: number;
  sessionsCount: number;
  dates: string[];
}

export class AnalyticsProjection {
  constructor(private store: AnalyticsEventStore) {}

  getAssessmentActivity(): AssessmentActivityProjection {
    const events = this.store.getEventsByType('assessment.completed');
    
    let totalScore = 0;
    
    events.forEach(evt => {
      totalScore += evt.payload.accuracy || 0;
    });

    return {
      totalAssessments: events.length,
      averageAccuracy: events.length > 0 ? totalScore / events.length : 0,
      completedAtDates: events.map(e => e.timestamp)
    };
  }

  getRevisionActivity(): RevisionActivityProjection {
    const events = this.store.getEventsByType('revision.completed');
    
    let totalAccuracy = 0;
    let totalDuration = 0;

    events.forEach(evt => {
      totalAccuracy += evt.payload.accuracy || 0;
      totalDuration += evt.payload.reviewDurationSeconds || 0;
    });

    return {
      totalRevisions: events.length,
      averageAccuracy: events.length > 0 ? totalAccuracy / events.length : 0,
      totalDurationSeconds: totalDuration,
      retentionTransitions: [] // Derived from other events in future
    };
  }

  getStudyTimeActivity(): StudyTimeProjection {
    const events = this.store.getEventsByType('study.session.completed');
    
    let totalTime = 0;

    events.forEach(evt => {
      totalTime += evt.payload.durationSeconds || 0;
    });

    return {
      totalStudyTimeSeconds: totalTime,
      sessionsCount: events.length,
      dates: events.map(e => e.timestamp)
    };
  }

  getRawEvents(): readonly AnalyticsEvent[] {
    return this.store.getEvents();
  }
}
