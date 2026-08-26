'use client';

import React from 'react';
import { useLearningContext } from '../learning/learning-context';
import { MOCK_CONVERSATIONS } from '../../mocks/workspace/ai-conversations';
import { AIEmptyState } from './ai-empty-state';
import { AIMessageList } from './ai-message-list';
import { AIInputBar } from './ai-input-bar';
import { FTUESuggestedQuestions } from '../onboarding/ftue-suggested-questions';

export function AITutorPanel() {
  const { ai } = useLearningContext();
  
  // For the mock, we fetch the conversation if activeConversationId exists
  const conversation = ai.activeConversationId 
    ? MOCK_CONVERSATIONS.find(c => c.id === ai.activeConversationId) 
    : null;

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Messages Area */}
      {conversation ? (
        <AIMessageList messages={conversation.messages} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <AIEmptyState />
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 relative">
        <FTUESuggestedQuestions />
        <AIInputBar />
      </div>
    </div>
  );
}
