'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useReaderState } from '../reader/reader-state';
import { useSelectionState } from './selection-state';
import { useReadingContext } from './reading-context-builder';
import { useAIContext } from './ai-context-provider';
import { useInteractionHistory } from './interaction-history';
import { LearningContext as ILearningContext } from '../../mocks/workspace/learning-context';
import { MOCK_CITATIONS } from '../../mocks/workspace/citations';
import { MOCK_CAPABILITY_REGISTRY } from '../../mocks/workspace/capability-registry';

const LearningContextFacade = createContext<ILearningContext | null>(null);

export const useLearningContext = () => {
  const context = useContext(LearningContextFacade);
  if (!context) throw new Error('useLearningContext must be used within LearningContextProvider');
  return context;
};

export const LearningContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useReaderState();
  const { selection } = useSelectionState();
  const { readingContext } = useReadingContext();
  const { aiContext } = useAIContext();
  const { history } = useInteractionHistory();

  const facade = useMemo<ILearningContext>(() => ({
    version: '1.0.0',
    reader: {}, // Placeholder for VirtualReader ref
    selection,
    reading: readingContext,
    ai: aiContext,
    session,
    citations: MOCK_CITATIONS,
    interactionHistory: history,
    capabilities: MOCK_CAPABILITY_REGISTRY
  }), [selection, readingContext, aiContext, session, history]);

  return (
    <LearningContextFacade.Provider value={facade}>
      {children}
    </LearningContextFacade.Provider>
  );
};
