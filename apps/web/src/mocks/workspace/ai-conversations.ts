import { AIMessage, MOCK_MESSAGES } from './ai-messages';

export interface AIConversation {
  id: string;
  documentId: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

export const MOCK_CONVERSATIONS: AIConversation[] = [
  {
    id: 'conv_1',
    documentId: 'doc_1',
    title: 'Krebs Cycle Explanation',
    messages: MOCK_MESSAGES,
    createdAt: '2026-07-01T10:05:00Z',
    updatedAt: '2026-07-01T10:05:15Z'
  }
];
