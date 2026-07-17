'use client';

import React, { createContext, useContext, useState } from 'react';
import { useReadingContext } from './reading-context-builder';
import { AIContext } from '../../mocks/workspace/ai-context';

interface AIContextProviderType {
  aiContext: AIContext;
  setSidebarOpen: (isOpen: boolean) => void;
  setActiveConversationId: (id: string | null) => void;
  setStatus: (status: 'idle' | 'generating' | 'error') => void;
}

const AIContextContext = createContext<AIContextProviderType | null>(null);

export const useAIContext = () => {
  const context = useContext(AIContextContext);
  if (!context) throw new Error('useAIContext must be used within AIContextProvider');
  return context;
};

export const AIContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { readingContext } = useReadingContext();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'generating' | 'error'>('idle');

  const aiContext: AIContext = {
    readingContext,
    activeConversationId,
    isSidebarOpen,
    status
  };

  return (
    <AIContextContext.Provider value={{ aiContext, setSidebarOpen, setActiveConversationId, setStatus }}>
      {children}
    </AIContextContext.Provider>
  );
};
