export interface ConversationMessage {
  id: string;
  role: 'coach' | 'student';
  text: string;
  timestamp: string;
  contextualPayload?: any;
}

export interface ConversationState {
  messages: ConversationMessage[];
  isTyping: boolean;
}
