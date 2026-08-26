import React from 'react';
import { useRevision } from '../revision-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Award, Clock, CheckCircle, Layers } from 'lucide-react';

export const RevisionSummaryCard: React.FC = () => {
  const { session, isSessionActive } = useRevision();

  if (isSessionActive || !session || session.status !== 'Completed') return null;

  const result = session.complete(); // It's idempotent
  if (!result) return null;

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
      <CardHeader>
        <CardTitle className="text-2xl text-center text-green-700 dark:text-green-400 flex justify-center items-center gap-2">
          <Award className="w-6 h-6" />
          Revision Complete!
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
            <CheckCircle className="w-5 h-5 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">Accuracy</p>
            <p className="text-2xl font-bold">{Math.round(result.accuracy * 100)}%</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
            <Layers className="w-5 h-5 mx-auto mb-2 text-blue-500" />
            <p className="text-sm text-muted-foreground">Reviewed</p>
            <p className="text-2xl font-bold">{result.reviewedAssetIds.length}</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
            <Clock className="w-5 h-5 mx-auto mb-2 text-orange-500" />
            <p className="text-sm text-muted-foreground">Time</p>
            <p className="text-2xl font-bold">{Math.round(result.reviewDurationSeconds / 60)}m</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
