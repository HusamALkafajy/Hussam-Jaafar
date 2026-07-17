import React from 'react';
import { useReaderState } from './reader-state';
import { ReaderHeader } from './reader-header';
import { ReaderSidebar } from './reader-sidebar';
import { cn } from '../../lib/utils';
import { ReadingProgress } from './reading-progress';

interface ReaderLayoutProps {
  children: React.ReactNode;
}

export function ReaderLayout({ children }: ReaderLayoutProps) {
  const { session } = useReaderState();
  const { isSidebarOpen, focusMode } = session;

  // In Focus Mode, we hide the sidebar completely and center the content
  const showSidebar = isSidebarOpen && !focusMode;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      {/* Sidebar - fixed width on desktop, collapsible */}
      {showSidebar && (
        <aside className="w-80 border-e shrink-0 flex flex-col bg-muted/20 z-10 transition-all duration-300">
          <ReaderSidebar />
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {!focusMode && (
          <header className="shrink-0 border-b z-10 bg-background/95 backdrop-blur">
            <ReaderHeader />
          </header>
        )}

        <main className="flex-1 relative overflow-hidden bg-muted/5">
          {children}
        </main>
        
        {!focusMode && (
          <footer className="shrink-0 border-t z-10 bg-background">
            <ReadingProgress />
          </footer>
        )}
      </div>
    </div>
  );
}
