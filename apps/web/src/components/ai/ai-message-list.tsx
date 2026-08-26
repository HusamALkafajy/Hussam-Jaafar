import React, { useRef, useEffect } from 'react';
import { AIMessage } from '../../mocks/workspace/ai-messages';
import { AIMessageBubble } from './ai-message-bubble';

interface AIMessageListProps {
  messages: AIMessage[];
}

export function AIMessageList({ messages }: AIMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-6 flex flex-col scroll-smooth"
    >
      {messages.map(msg => (
        <AIMessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
}
