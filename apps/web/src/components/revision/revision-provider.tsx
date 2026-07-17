'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { RevisionQueue } from '@studyai/domain/revision/scheduler/revision-queue';
import { RevisionSession } from '@studyai/domain/revision/revision-session';
import { RevisionTimeline } from '@studyai/domain/revision/revision-timeline';
import { DeterministicRevisionAlgorithm } from '@studyai/domain/revision/memory/revision-algorithm';
import { RevisionScheduler } from '@studyai/domain/revision/scheduler/revision-scheduler';
import { RevisionItem, DifficultyLevel } from '@studyai/domain/revision/revision-item';

interface RevisionContextValue {
  queue: RevisionQueue;
  session: RevisionSession | null;
  timeline: RevisionTimeline;
  startSession: (items: RevisionItem[]) => void;
  reviewCurrent: (performance: DifficultyLevel) => void;
  skipCurrent: () => void;
  finishSession: () => void;
  isSessionActive: boolean;
  tick: number; // For forcing rerenders
}

const RevisionContext = createContext<RevisionContextValue | null>(null);

export function RevisionProvider({ children, initialItems = [] }: { children: React.ReactNode, initialItems?: RevisionItem[] }) {
  const [queue] = useState(() => new RevisionQueue(initialItems));
  const [timeline] = useState(() => new RevisionTimeline());
  const [scheduler] = useState(() => {
    const algorithm = new DeterministicRevisionAlgorithm();
    return new RevisionScheduler(algorithm, queue);
  });
  
  const [session, setSession] = useState<RevisionSession | null>(null);
  const [tick, setTick] = useState(0);

  const startSession = useCallback((items: RevisionItem[]) => {
    const newSession = new RevisionSession(`session_${Date.now()}`, items, scheduler, timeline);
    newSession.start();
    setSession(newSession);
    setTick(t => t + 1);
  }, [scheduler, timeline]);

  const reviewCurrent = useCallback((performance: DifficultyLevel) => {
    if (session) {
      session.reviewCurrentItem(performance);
      setTick(t => t + 1);
    }
  }, [session]);

  const skipCurrent = useCallback(() => {
    if (session) {
      session.skip();
      setTick(t => t + 1);
    }
  }, [session]);

  const finishSession = useCallback(() => {
    if (session) {
      const result = session.complete();
      if (result) {
        // Result is generated
      }
      setTick(t => t + 1);
    }
  }, [session]);

  const value = useMemo(() => ({
    queue,
    session,
    timeline,
    startSession,
    reviewCurrent,
    skipCurrent,
    finishSession,
    isSessionActive: session !== null && session.status === 'InProgress',
    tick
  }), [queue, session, timeline, tick, startSession, reviewCurrent, skipCurrent, finishSession]);

  return (
    <RevisionContext.Provider value={value}>
      {children}
    </RevisionContext.Provider>
  );
}

export function useRevision() {
  const context = useContext(RevisionContext);
  if (!context) {
    throw new Error('useRevision must be used within RevisionProvider');
  }
  return context;
}
