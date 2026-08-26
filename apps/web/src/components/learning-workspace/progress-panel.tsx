'use client';

import React from 'react';
import { useLearningWorkspace } from './learning-workspace-provider';
import { Target } from 'lucide-react';

export function ProgressPanel() {
  const { learning } = useLearningWorkspace();
  const session = learning.session;

  if (!session) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Target className="w-4 h-4 text-primary" />
        Session Progress
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs font-medium">
          <span>Completion</span>
          <span>{Math.round(session.progress * 100)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-500 ease-out" 
            style={{ width: `${session.progress * 100}%` }}
          />
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        <p>Keep going! You're making great progress in this session.</p>
      </div>
    </div>
  );
}
