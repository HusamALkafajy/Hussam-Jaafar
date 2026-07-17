'use client';

import React from 'react';
import { useFTUE } from '../../hooks/use-ftue';
import { actionRegistry } from '../ai/action-registry';
import { Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  "Summarize this document",
  "Explain the key concepts",
  "Create a study guide",
];

export function FTUESuggestedQuestions() {
  const { state, isReady, markAsSeen } = useFTUE();

  // Show only if they have seen the summary but haven't used the chat yet
  if (!isReady || !state.hasSeenSummary || state.hasSeenChatTooltip) {
    return null;
  }

  const handleSuggestionClick = (prompt: string) => {
    // Dispatch the prompt directly to the AI
    actionRegistry.dispatch({
      capabilityId: 'ask-ai',
      payload: { prompt }
    });
    
    // Mark the chat discovery feature as seen
    markAsSeen('hasSeenChatTooltip');
  };

  return (
    <div className="absolute bottom-16 left-0 right-0 p-4 pb-2 z-10 flex flex-col gap-2 pointer-events-none motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in duration-500">
      <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-primary mb-1">
        <Sparkles className="size-3" />
        <span>Ask StudyAI to explain anything</span>
      </div>
      <div className="flex flex-col gap-2 pointer-events-auto">
        {SUGGESTIONS.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => handleSuggestionClick(suggestion)}
            className="text-left px-3 py-2 text-sm bg-background border border-primary/20 hover:border-primary/50 hover:bg-muted text-foreground rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
