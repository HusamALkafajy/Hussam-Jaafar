'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { CoachPresentationState, CoachViewState, CoachDomainState } from './coach-state';
import { InsightBuilder } from './insight-builder';

// Mock imports
import { MOCK_STUDY_PLANS } from '../../mocks/adaptive/study-plans';
import { MOCK_TIMELINE_EVENTS } from '../../mocks/adaptive/timeline';
import { MOCK_PROGRESS } from '../../mocks/adaptive/progress';

interface StudyCoachContextValue {
  presentation: CoachPresentationState;
  view: CoachViewState;
  domain: CoachDomainState;
  setPresentation: React.Dispatch<React.SetStateAction<CoachPresentationState>>;
  setView: React.Dispatch<React.SetStateAction<CoachViewState>>;
}

const StudyCoachContext = createContext<StudyCoachContextValue | null>(null);

export function StudyCoachProvider({ children, documentId }: { children: React.ReactNode; documentId: string }) {
  const [presentation, setPresentation] = useState<CoachPresentationState>({
    activeTab: 'overview',
    conversationExpanded: false,
    filters: {}
  });

  const [view, setView] = useState<CoachViewState>({});

  // In a real implementation, we would load the plan & timeline from the Orchestrator/API based on documentId
  const [domain, setDomain] = useState<CoachDomainState>({
    plan: MOCK_STUDY_PLANS[0],
    context: {
      session: {
        id: 'session_1',
        documentId: documentId,
        assets: [],
        history: [],
        recommendations: [],
        progress: MOCK_PROGRESS.sessionProgress,
        metrics: {
          sessionDurationSeconds: 1200,
          assetsGenerated: 0,
          assetsReviewed: MOCK_PROGRESS.reviewedAssets,
          masteryScore: 0.8,
          engagementScore: 0.9
        }
      }
    },
    timeline: MOCK_TIMELINE_EVENTS,
    insights: []
  });

  // Re-build insights whenever domain plan or context changes
  useEffect(() => {
    const insights = InsightBuilder.buildInsights(domain.plan, domain.context);
    setDomain(prev => ({ ...prev, insights }));
  }, [domain.plan, domain.context]);

  const value = useMemo(() => ({
    presentation,
    view,
    domain,
    setPresentation,
    setView
  }), [presentation, view, domain]);

  return (
    <StudyCoachContext.Provider value={value}>
      {children}
    </StudyCoachContext.Provider>
  );
}

export function useStudyCoach() {
  const context = useContext(StudyCoachContext);
  if (!context) {
    throw new Error('useStudyCoach must be used within a StudyCoachProvider');
  }
  return context;
}
