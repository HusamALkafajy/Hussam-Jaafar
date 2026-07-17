import React from 'react';
import { useAssessment } from '../assessment-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';

export const SummaryCard: React.FC = () => {
  const { session, isFinished, finishAssessment } = useAssessment();
  
  const result = session.attempt.result;

  if (!isFinished) {
    const { answered, totalQuestions } = session.progress;
    return (
      <div className="flex justify-end mt-8">
        <Button onClick={finishAssessment} disabled={answered < totalQuestions}>
          Finish Assessment
        </Button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <Card className="max-w-2xl mx-auto mt-8 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
      <CardHeader>
        <CardTitle className="text-2xl text-center text-green-700 dark:text-green-400">
          Assessment Complete!
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
            <p className="text-sm text-muted-foreground">Accuracy</p>
            <p className="text-3xl font-bold">{Math.round(result.accuracy * 100)}%</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
            <p className="text-sm text-muted-foreground">Score</p>
            <p className="text-3xl font-bold">{result.score}</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Strengths</h4>
          <ul className="list-disc pl-5 text-sm text-green-700 dark:text-green-400">
            {result.feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Areas to Review</h4>
          <ul className="list-disc pl-5 text-sm text-red-600 dark:text-red-400">
            {result.feedback.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
