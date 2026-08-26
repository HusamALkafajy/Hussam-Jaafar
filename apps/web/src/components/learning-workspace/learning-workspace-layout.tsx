import React from 'react';

export function LearningWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {children}
    </div>
  );
}
