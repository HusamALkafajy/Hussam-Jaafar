'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UIState, WorkspaceLearningState } from './workspace-state';
import { assetRegistry } from '@studyai/domain/asset-registry';
import { MOCK_LEARNING_SESSIONS } from '../../mocks/workspace/learning-sessions';
import { MOCK_RECOMMENDATIONS } from '../../mocks/workspace/recommendations';
import { MOCK_LEARNING_METRICS } from '../../mocks/workspace/learning-metrics';

interface WorkspaceContextValue {
  ui: UIState;
  learning: WorkspaceLearningState;
  updateUI: (updates: Partial<UIState>) => void;
  updateLearningSession: (action: string, payload?: any) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function LearningWorkspaceProvider({ 
  documentId, 
  children 
}: { 
  documentId: string, 
  children: React.ReactNode 
}) {
  const [ui, setUI] = useState<UIState>({
    selectedTab: 'Flashcards',
    expandedSections: [],
    drawerVisibility: { citation: false },
    search: '',
    filters: {},
    selectedAssetId: null
  });

  const [learning, setLearning] = useState<WorkspaceLearningState>({
    session: null,
    assets: [],
    metrics: null,
    recommendations: []
  });

  useEffect(() => {
    // 1. Load session (Mocked for now)
    const session = MOCK_LEARNING_SESSIONS.find((s: any) => s.documentId === documentId) || null;
    
    // 2. Load Assets through Registry
    const allAssets = assetRegistry.filter((a: any) => a.sourceCitation.documentId === documentId);

    // 3. Load Metrics & Recommendations (Mocked)
    const metrics = MOCK_LEARNING_METRICS;
    const recommendations = MOCK_RECOMMENDATIONS;

    setLearning({
      session,
      assets: allAssets,
      metrics,
      recommendations
    });
  }, [documentId]);

  const updateUI = useCallback((updates: Partial<UIState>) => {
    setUI(prev => ({ ...prev, ...updates }));
  }, []);

  const updateLearningSession = useCallback((action: string, payload?: any) => {
    // Dispatch mutations to the Learning Session (mocked for now)
    console.log(`[Workspace] Action Dispatched: ${action}`, payload);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ ui, learning, updateUI, updateLearningSession }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useLearningWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useLearningWorkspace must be used within LearningWorkspaceProvider');
  return context;
}
