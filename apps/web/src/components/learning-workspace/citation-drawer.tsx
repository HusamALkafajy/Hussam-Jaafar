'use client';

import React from 'react';
import { useLearningWorkspace } from './learning-workspace-provider';
import { Button } from '../ui/button';
import { X, ExternalLink } from 'lucide-react';
import { ImmutableCitation } from '@studyai/domain/citation';

export function CitationDrawer() {
  const { ui, updateUI } = useLearningWorkspace();
  
  // Actually, the drawer visibility should take a Citation object if it's open, 
  // or we read the active asset's citation.
  // For now, let's just close it.

  if (!ui.drawerVisibility.citation) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-background border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-semibold">Source Citation</h3>
        <Button variant="ghost" size="icon" onClick={() => updateUI({ drawerVisibility: { ...ui.drawerVisibility, citation: false } })}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="p-6 flex flex-col gap-4">
        <div className="bg-muted/30 p-4 rounded-lg border">
          <p className="text-sm font-mono text-muted-foreground break-all">
            Origin traceable to canonical AST.
          </p>
        </div>
        
        <Button className="w-full" variant="outline">
          <ExternalLink className="w-4 h-4 mr-2" />
          Jump to Reader
        </Button>
      </div>
    </div>
  );
}
