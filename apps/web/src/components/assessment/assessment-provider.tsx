'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { AssessmentAttempt, AnswerPayload } from '@studyai/domain/assessment/assessment-attempt';
import { AssessmentSession } from '@studyai/domain/assessment/assessment-session';
import { AnswerRegistry } from '@studyai/domain/assessment/answer-registry';
import { ResultBuilder } from '@studyai/domain/assessment/evaluation/result-builder';
import { LearningAsset } from '@studyai/domain/learning-asset';

interface AssessmentContextValue {
  session: AssessmentSession;
  assets: LearningAsset[];
  registry: AnswerRegistry;
  currentAsset?: LearningAsset;
  currentAnswer?: any;
  submitAnswer: (value: any) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  finishAssessment: () => void;
  isFinished: boolean;
}

const AssessmentContext = createContext<AssessmentContextValue | null>(null);

export function AssessmentProvider({ 
  children, 
  attemptId, 
  assessmentId, 
  assets 
}: { 
  children: React.ReactNode; 
  attemptId: string; 
  assessmentId: string; 
  assets: LearningAsset[];
}) {
  const [registry] = useState(() => new AnswerRegistry());
  const [session] = useState(() => {
    const attempt = new AssessmentAttempt(attemptId, assessmentId, assets.map(a => a.assetId));
    return new AssessmentSession(attempt, assets.map(a => a.assetId));
  });

  // Force re-render on state changes
  const [tick, setTick] = useState(0);

  useEffect(() => {
    session.start();
    setTick(t => t + 1);
  }, [session]);

  const currentAsset = useMemo(() => {
    return assets.find(a => a.assetId === session.currentQuestionId);
  }, [assets, session.currentQuestionId]);

  const currentAnswer = session.currentQuestionId ? registry.retrieve(session.currentQuestionId)?.value : undefined;

  const submitAnswer = useCallback((value: any) => {
    if (!session.currentQuestionId) return;
    
    const payload: AnswerPayload = {
      questionId: session.currentQuestionId,
      value,
      submittedAt: new Date().toISOString()
    };
    
    registry.store(payload);
    session.attempt.recordAnswer(payload);
    setTick(t => t + 1);
  }, [session, registry]);

  const nextQuestion = useCallback(() => {
    session.next();
    setTick(t => t + 1);
  }, [session]);

  const previousQuestion = useCallback(() => {
    session.previous();
    setTick(t => t + 1);
  }, [session]);

  const finishAssessment = useCallback(() => {
    const result = ResultBuilder.buildResult(session, assets);
    session.complete(result);
    setTick(t => t + 1);
  }, [session, assets]);

  const value = useMemo(() => ({
    session,
    assets,
    registry,
    currentAsset,
    currentAnswer,
    submitAnswer,
    nextQuestion,
    previousQuestion,
    finishAssessment,
    isFinished: session.attempt.status === 'Completed'
  }), [session, assets, registry, currentAsset, currentAnswer, tick, submitAnswer, nextQuestion, previousQuestion, finishAssessment]);

  return (
    <AssessmentContext.Provider value={value}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment() {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within AssessmentProvider');
  }
  return context;
}
