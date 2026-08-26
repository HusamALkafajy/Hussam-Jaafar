import React, { useState } from 'react';
import { actionRegistry } from './action-registry';
import { Button } from '../ui/button';
import { SendHorizontal } from 'lucide-react';

export function AIInputBar() {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    actionRegistry.dispatch({
      capabilityId: 'ask-ai',
      payload: { prompt: input }
    });
    
    setInput('');
  };

  return (
    <div className="p-3 border-t bg-background">
      <form 
        onSubmit={handleSubmit}
        className="flex items-center gap-2 bg-muted/50 border rounded-xl px-3 py-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
        />
        <Button 
          type="submit" 
          size="icon" 
          variant="ghost" 
          disabled={!input.trim()}
          className="size-8 text-primary hover:bg-primary/10 hover:text-primary rounded-lg shrink-0 disabled:opacity-50"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
