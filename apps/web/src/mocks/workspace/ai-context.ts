import { ReadingContext } from './reading-context';

export interface AIContext {
  readingContext: ReadingContext;
  activeConversationId: string | null;
  isSidebarOpen: boolean;
  status: 'idle' | 'generating' | 'error';
}

export const MOCK_AI_CONTEXT: AIContext = {
  readingContext: {} as ReadingContext, // Injected at runtime
  activeConversationId: 'conv_1',
  isSidebarOpen: true,
  status: 'idle'
};
