'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { AnalyticsEngine } from '@studyai/domain/analytics/analytics-engine';
import { AnalyticsProjection } from '@studyai/domain/analytics/store/analytics-projection';
import { AnalyticsEventStore } from '@studyai/domain/analytics/store/analytics-event-store';
import { AnalyticsSnapshot } from '@studyai/domain/analytics/analytics-snapshot';
import { AnalyticsInsight } from '@studyai/domain/analytics/analytics-insight';

interface AnalyticsContextValue {
  snapshot: AnalyticsSnapshot;
  insights: AnalyticsInsight[];
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => {
    const s = new AnalyticsEventStore();
    // Pre-seed some mock data for UI testing since we don't have a real DB hooked up
    s.append({ type: 'assessment.completed', timestamp: new Date().toISOString(), payload: { accuracy: 0.85 } });
    s.append({ type: 'study.session.completed', timestamp: new Date().toISOString(), payload: { durationSeconds: 1800 } });
    s.append({ type: 'revision.completed', timestamp: new Date().toISOString(), payload: { accuracy: 0.92, reviewDurationSeconds: 600 } });
    return s;
  });

  const [projection] = useState(() => new AnalyticsProjection(store));
  const [engine] = useState(() => new AnalyticsEngine(projection));

  const value = useMemo(() => ({
    snapshot: engine.getSnapshot(),
    insights: engine.getInsights(),
  }), [engine]);

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
}
