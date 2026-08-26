'use client';

import React from 'react';
import { useLearningWorkspace } from './learning-workspace-provider';
import { Button } from '../ui/button';

const TABS = ['Flashcards', 'Quiz', 'Revision', 'Summaries'] as const;

export function LearningNavigation() {
  const { ui, updateUI } = useLearningWorkspace();

  return (
    <nav className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
      {TABS.map(tab => (
        <Button
          key={tab}
          variant={ui.selectedTab === tab ? 'default' : 'ghost'}
          size="sm"
          onClick={() => updateUI({ selectedTab: tab })}
        >
          {tab}
        </Button>
      ))}
    </nav>
  );
}
