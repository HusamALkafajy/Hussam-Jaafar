export type InternalEventName = 
  | 'conversation.started'
  | 'message.streaming'
  | 'message.completed'
  | 'response.regenerated'
  | 'action.executed'
  | 'citation.opened'
  | 'selection.changed'
  | 'asset.generated'
  | 'asset.reviewed'
  | 'asset.completed'
  | 'recommendation.generated'
  | 'session.started'
  | 'session.completed'
  | 'artifact.created';

export interface InternalEvent<T = any> {
  id: string;
  name: InternalEventName;
  timestamp: string;
  payload: T;
}

export const MOCK_EVENTS: InternalEvent[] = [
  {
    id: 'evt_1',
    name: 'conversation.started',
    timestamp: '2026-07-01T10:00:00Z',
    payload: { conversationId: 'conv_1' }
  }
];
