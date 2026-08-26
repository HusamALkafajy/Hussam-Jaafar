'use client';

import React, { useEffect, useState } from 'react';
import { useAssessment } from './assessment-provider';
import { QuestionPresenterRegistry } from './question-presenter-registry';
import { MultipleChoicePresenter } from './presenters/multiple-choice-presenter';
import { TrueFalsePresenter } from './presenters/true-false-presenter';
import { ProgressBar } from './components/progress-bar';
import { QuestionNavigator } from './components/question-navigator';
import { SummaryCard } from './components/summary-card';

// Register standard presenters
if (typeof window !== 'undefined') {
  QuestionPresenterRegistry.register({
    assetType: 'multiple-choice',
    component: MultipleChoicePresenter
  });
  
  QuestionPresenterRegistry.register({
    assetType: 'true-false',
    component: TrueFalsePresenter
  });
}

export const AssessmentWorkspace: React.FC = () => {
  const { isFinished, currentAsset, currentAnswer, submitAnswer } = useAssessment();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8">
      <ProgressBar />
      
      {isFinished ? (
        <SummaryCard />
      ) : currentAsset ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border p-8">
          {(() => {
            const Presenter = QuestionPresenterRegistry.getPresenter(currentAsset.assetType);
            if (!Presenter) {
              return <div className="text-red-500">Unsupported question type: {currentAsset.assetType}</div>;
            }
            return (
              <Presenter 
                asset={currentAsset} 
                currentValue={currentAnswer} 
                onAnswer={submitAnswer} 
              />
            );
          })()}
          <QuestionNavigator />
          <SummaryCard /> {/* Render finish button if available */}
        </div>
      ) : (
        <div className="text-center p-8 text-muted-foreground">Loading question...</div>
      )}
    </div>
  );
};
