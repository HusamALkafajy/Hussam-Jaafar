export interface InteractionEvent {
  id: string;
  documentId: string;
  type: 'question' | 'response' | 'action_executed' | 'bookmark_created' | 'highlight_created';
  payload: any;
  timestamp: string;
}

export const MOCK_INTERACTION_HISTORY: InteractionEvent[] = [
  {
    id: 'ih_1',
    documentId: 'doc_1',
    type: 'action_executed',
    payload: { action: 'explain', context: 'node_42' },
    timestamp: '2026-07-01T10:05:00Z'
  }
];
