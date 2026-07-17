import { TimelineEvent } from '@studyai/domain/adaptive/learning-timeline';

export const MOCK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'evt_1',
    type: 'session.started',
    timestamp: '2026-07-01T10:00:00Z',
    payload: { sessionId: 'session_1' }
  }
];
