import { ResponseCard } from './response-card-registry';

export type MessageStatus = 'draft' | 'streaming' | 'completed' | 'regenerated' | 'archived';

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  status: MessageStatus;
  cards: ResponseCard[]; // The structured content
  rawText?: string;      // The raw markdown if needed
  citations: string[];   // Citation IDs
  timestamp: string;
}

export const MOCK_MESSAGES: AIMessage[] = [
  {
    id: 'msg_1',
    conversationId: 'conv_1',
    role: 'user',
    status: 'completed',
    cards: [{ type: 'TextCard', payload: { text: 'What is the Krebs Cycle?' } }],
    citations: [],
    timestamp: '2026-07-01T10:05:10Z'
  },
  {
    id: 'msg_2',
    conversationId: 'conv_1',
    role: 'assistant',
    status: 'completed',
    cards: [
      { type: 'ExplanationCard', payload: { title: 'The Krebs Cycle', content: 'Also known as the citric acid cycle...' } },
      { type: 'KeyTakeawaysCard', payload: { points: ['Occurs in mitochondria', 'Generates ATP'] } }
    ],
    citations: ['cit_1'],
    timestamp: '2026-07-01T10:05:15Z'
  }
];
