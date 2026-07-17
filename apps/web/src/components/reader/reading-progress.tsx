import React from 'react';
import { useReaderState } from './reader-state';

export function ReadingProgress() {
  const { readingProgress, document, outline, session } = useReaderState();
  
  const currentHeading = outline.flatMap(n => [n, ...(n.children || [])]).find(n => n.nodeId === session.currentNodeId)?.title || 'Introduction';

  // Calculate estimated remaining time based on progress
  const progressRatio = readingProgress / 100;
  const remainingMinutes = Math.max(0, Math.ceil(document.estimatedTotalTimeMinutes * (1 - progressRatio)));

  return (
    <div className="flex flex-col w-full bg-background border-t">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>
      
      {/* Footer Details */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground truncate max-w-[200px] hidden sm:inline-block">
            {currentHeading}
          </span>
          <span>{Math.round(readingProgress)}% read</span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-block">~{remainingMinutes} min left</span>
          {/* Streak placeholder */}
          <span className="flex items-center gap-1 font-medium text-orange-500">
            🔥 3 day streak
          </span>
        </div>
      </div>
    </div>
  );
}
