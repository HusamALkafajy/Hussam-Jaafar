import React from 'react';
import { useRevision } from '../revision-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Layers } from 'lucide-react';

export const RevisionQueuePanel: React.FC = () => {
  const { queue, startSession, isSessionActive, tick } = useRevision();
  
  if (isSessionActive) return null;

  const state = queue.getState();
  const totalDue = state.overdue.length + state.today.length;

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Layers className="w-6 h-6 text-primary" />
          Revision Queue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg shadow-sm border border-red-100 dark:border-red-900">
            <p className="text-sm text-red-600 dark:text-red-400">Overdue</p>
            <p className="text-3xl font-bold text-red-700 dark:text-red-300">{state.overdue.length}</p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg shadow-sm border border-blue-100 dark:border-blue-900">
            <p className="text-sm text-blue-600 dark:text-blue-400">Due Today</p>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{state.today.length}</p>
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            className="w-full sm:w-auto"
            onClick={() => startSession([...state.overdue, ...state.today].slice(0, 10))}
            disabled={totalDue === 0}
          >
            Start Revision Batch (Max 10)
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground mt-4">
          {state.upcoming.length} upcoming items in the future.
        </div>
      </CardContent>
    </Card>
  );
};
