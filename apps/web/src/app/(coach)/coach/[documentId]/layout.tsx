import React from 'react';

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6">
        <h1 className="font-semibold text-lg">Study Coach</h1>
      </header>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
