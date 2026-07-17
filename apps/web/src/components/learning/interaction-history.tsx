'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { InteractionEvent, MOCK_INTERACTION_HISTORY } from '../../mocks/workspace/interaction-history';
import { internalEvents } from './events';

interface InteractionHistoryContextType {
  history: InteractionEvent[];
  logEvent: (type: InteractionEvent['type'], payload: any) => void;
}

const InteractionHistoryContext = createContext<InteractionHistoryContextType | null>(null);

export const useInteractionHistory = () => {
  const context = useContext(InteractionHistoryContext);
  if (!context) throw new Error('useInteractionHistory must be used within InteractionHistoryProvider');
  return context;
};

export const InteractionHistoryProvider: React.FC<{ documentId: string, children: React.ReactNode }> = ({ documentId, children }) => {
  const [history, setHistory] = useState<InteractionEvent[]>(MOCK_INTERACTION_HISTORY);

  const logEvent = useCallback((type: InteractionEvent['type'], payload: any) => {
    const event: InteractionEvent = {
      id: `ih_${Date.now()}`,
      documentId,
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    setHistory(prev => [...prev, event]);
  }, [documentId]);

  useEffect(() => {
    const unsubscribe = internalEvents.subscribe('action.executed', (e) => {
      logEvent('action_executed', e.payload);
    });
    return unsubscribe;
  }, [documentId, logEvent]);

  return (
    <InteractionHistoryContext.Provider value={{ history, logEvent }}>
      {children}
    </InteractionHistoryContext.Provider>
  );
};
