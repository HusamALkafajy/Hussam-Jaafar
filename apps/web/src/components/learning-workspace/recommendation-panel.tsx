'use client';

import React from 'react';
import { useLearningWorkspace } from './learning-workspace-provider';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

export function RecommendationPanel() {
  const { learning, updateUI } = useLearningWorkspace();
  const rec = learning.recommendations[0];

  if (!rec) return null;

  return (
    <div className="flex flex-col gap-3 bg-primary/5 rounded-xl p-4 border border-primary/20">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Lightbulb className="w-4 h-4" />
        Suggested Activity
      </div>
      <p className="text-sm font-medium">
        {rec.explanation}
      </p>
      <div className="text-xs text-muted-foreground flex justify-between items-center mt-1">
        <span>Confidence: {Math.round(rec.confidence * 100)}%</span>
        <span className="uppercase font-semibold tracking-wider text-[10px] bg-primary/10 px-1.5 py-0.5 rounded text-primary">
          {rec.priority} PRIORITY
        </span>
      </div>
      <Button 
        className="w-full mt-2" 
        size="sm"
        onClick={() => {
          if (rec.targetResourceId) {
            updateUI({ selectedAssetId: rec.targetResourceId });
          }
        }}
      >
        {rec.type} <ArrowRight className="w-3.5 h-3.5 ml-2" />
      </Button>
    </div>
  );
}
