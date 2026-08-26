import React from 'react';

export const RevisionLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6">
        <h1 className="font-semibold text-lg">Revision Platform</h1>
      </header>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
};
