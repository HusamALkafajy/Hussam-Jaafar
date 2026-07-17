import React from 'react';
import { AIMessage } from '../../mocks/workspace/ai-messages';
import { ResponseCardRenderer } from './response-card-registry';
import { Bot, User, BookmarkPlus, Copy, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';

export function AIMessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full gap-3 ${isUser ? 'flex-row-reverse' : ''} group`}>
      {/* Avatar */}
      <div className={`shrink-0 size-8 rounded-full flex items-center justify-center ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted border'}`}>
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      {/* Message Content */}
      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`flex flex-col gap-2 rounded-2xl px-4 py-3 ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border shadow-sm rounded-tl-sm'}`}>
          {message.cards.map((card, i) => (
            <ResponseCardRenderer key={i} card={card} />
          ))}
          
          {/* Citations block placeholder */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-1">
              <span className="font-medium">Sources:</span>
              {message.citations.map((cit, i) => (
                <button key={i} className="hover:text-primary hover:underline transition-colors">
                  [{i + 1}]
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Follow-up actions (only on assistant hover, or completed status) */}
        {!isUser && message.status === 'completed' && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" title="Copy">
              <Copy className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" title="Regenerate">
              <RotateCcw className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" title="Add Bookmark">
              <BookmarkPlus className="size-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
