import React from 'react';
import { Recommendation } from '@studyai/domain';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Bot, ArrowRight } from 'lucide-react';

interface Props {
  recommendation: Recommendation;
}

export function TutorRecommendationWidget({ recommendation }: Props) {
  return (
    <Card 
      className="flex flex-col md:flex-row items-center justify-between p-6 bg-blue-500/5 border-blue-500/20 hover:border-blue-500/50 transition-colors gap-4 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
      role="region"
      aria-labelledby={`rec-title-${recommendation.id}`}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="p-4 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full shrink-0" aria-hidden="true">
          <Bot className="w-8 h-8" />
        </div>
        <div>
          <h3 id={`rec-title-${recommendation.id}`} className="text-lg font-bold text-foreground">Ask the AI Tutor</h3>
          <p className="text-sm text-muted-foreground mt-1">{recommendation.explanation}</p>
        </div>
      </div>
      
      <Button 
        size="lg" 
        variant="secondary" 
        className="w-full md:w-auto shrink-0 group"
        aria-label="Start tutor chat session"
      >
        Start Chat
        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </Button>
    </Card>
  );
}
