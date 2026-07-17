import React from 'react';
import { useAssessment } from '../assessment-provider';

export const ProgressBar: React.FC = () => {
  const { session, isFinished } = useAssessment();
  
  if (isFinished) return null;

  const { percentComplete } = session.progress;

  return (
    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
      <div 
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${percentComplete * 100}%` }}
      />
    </div>
  );
};
