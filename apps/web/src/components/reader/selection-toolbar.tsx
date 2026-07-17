import React, { useEffect, useState } from 'react';
import { useLearningContext } from '../learning/learning-context';
import { actionRegistry } from '../ai/action-registry';
import { useReaderState } from './reader-state';
import { Button } from '../ui/button';
import { Highlighter, BookmarkPlus, Copy, Bot, MessageSquare, List, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';

export function SelectionToolbar() {
  const { setSelectedText } = useReaderState();
  const { session, updateSession } = useReaderState();
  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);

  const handleAction = (capabilityId: string) => {
    actionRegistry.dispatch({ capabilityId });
    // Also open the AI sidebar if not open
    if (session.sidebarTab !== 'ai') {
      updateSession({ sidebarTab: 'ai' });
    }
  };

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setPosition(null);
        setSelectedText(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Position above the selection, centered
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
      setSelectedText(selection.toString());
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection); // For keyboard selection

    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('keyup', handleSelection);
    };
  }, [setSelectedText]);

  if (!position) return null;

  return (
    <div 
      className="fixed z-50 flex items-center bg-background border shadow-xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <div className="flex items-center p-1 border-r border-border/50 bg-muted/20">
        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10">
          <Highlighter className="size-3.5" />
          Highlight
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-600 hover:bg-blue-500/10">
          <BookmarkPlus className="size-3.5" />
          Bookmark
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Copy className="size-3.5" />
          Copy
        </Button>
      </div>

      <div className="flex items-center p-1 bg-primary/5">
        <Button onClick={() => handleAction('ask-ai')} variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10">
          <Bot className="size-3.5" />
          Ask AI
        </Button>
        <Button onClick={() => handleAction('explain')} variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10">
          <MessageSquare className="size-3.5" />
          Explain
        </Button>
        <Button onClick={() => handleAction('summarize')} variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10">
          <List className="size-3.5" />
          Summarize
        </Button>
        <Button variant="ghost" size="sm" disabled className="h-8 px-2 gap-1.5 text-xs font-medium opacity-50">
          <Layers className="size-3.5" />
          Flashcard
        </Button>
      </div>
    </div>
  );
}
