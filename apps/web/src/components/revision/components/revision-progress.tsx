import React from 'react';
import { useRevision } from '../revision-provider';
import { Button } from '../../ui/button';

export const RevisionProgress: React.FC = () => {
  const { session, finishSession, isSessionActive } = useRevision();

  if (!isSessionActive || !session) return null;

  const { percentComplete, reviewed, total } = session.progress;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2 mt-8">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium">Progress</span>
        <span className="text-muted-foreground">{reviewed} / {total} items</span>
      </div>
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentComplete * 100}%` }}
        />
      </div>
      {reviewed === total && (
        <div className="pt-4 flex justify-end">
          <Button onClick={finishSession} size="lg">Complete Session</Button>
        </div>
      )}
    </div>
  );
};
