'use client';

import React from 'react';
import { SelectionStateProvider } from './selection-state';
import { ReadingContextBuilderProvider } from './reading-context-builder';
import { AIContextProvider } from './ai-context-provider';
import { InteractionHistoryProvider } from './interaction-history';
import { LearningContextProvider } from './learning-context';

export function LearningPlatformProvider({ documentId, children }: { documentId: string, children: React.ReactNode }) {
  return (
    <SelectionStateProvider>
      <ReadingContextBuilderProvider>
        <AIContextProvider>
          <InteractionHistoryProvider documentId={documentId}>
            <LearningContextProvider>
              {children}
            </LearningContextProvider>
          </InteractionHistoryProvider>
        </AIContextProvider>
      </ReadingContextBuilderProvider>
    </SelectionStateProvider>
  );
}
