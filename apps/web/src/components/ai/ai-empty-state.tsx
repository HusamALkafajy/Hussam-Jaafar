import React from 'react';
import { useReadingContext } from '../learning/reading-context-builder';
import { questionGenerator } from './question-generator';
import { actionRegistry } from './action-registry';
import { Button } from '../ui/button';
import { Sparkles } from 'lucide-react';

export function AIEmptyState() {
  const { readingContext } = useReadingContext();
  const suggestions = questionGenerator.getSuggestions(readingContext);

  const handleSuggestionClick = (prompt: string) => {
    actionRegistry.dispatch({
      capabilityId: 'ask-ai',
      payload: { prompt }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="size-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Study Companion</h3>
      <p className="text-sm text-muted-foreground mb-8 max-w-[250px]">
        I can help you understand concepts, summarize sections, and prepare for exams.
      </p>

      <div className="w-full space-y-2 flex flex-col items-stretch">
        {suggestions.map(suggestion => (
          <Button
            key={suggestion.id}
            variant="outline"
            className="justify-start h-auto py-3 px-4 text-left font-normal"
            onClick={() => handleSuggestionClick(suggestion.prompt)}
          >
            <span className="text-sm">{suggestion.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
