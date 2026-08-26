import React from 'react';

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-background">
      {children}
    </div>
  );
}
