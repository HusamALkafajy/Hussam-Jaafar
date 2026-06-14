export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface ChatMessageReference {
  page?: number | null;
  text?: string | null;
}

export interface ChatSession {
  id: string;
  fileId: string;
  userId: string;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  references?: ChatMessageReference[] | null;
  createdAt: Date;
}

export interface CreateChatSessionDto {
  fileId: string;
  title?: string;
}

export interface SendChatMessageDto {
  content: string;
}
