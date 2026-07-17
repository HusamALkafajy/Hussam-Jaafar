import React from 'react';
import { useReaderState } from './reader-state';
import { Button } from '../ui/button';
import { TypographySettings } from './typography-settings';
import { Focus, Maximize, ArrowLeft, Sidebar as SidebarIcon } from 'lucide-react';
import Link from 'next/link';

export function ReaderHeader() {
  const { document, session, updateSession, outline } = useReaderState();
  
  // Find current heading from outline using currentNodeId
  const currentHeading = outline.flatMap(n => [n, ...(n.children || [])]).find(n => n.nodeId === session.currentNodeId)?.title || 'Introduction';

  return (
    <div className="flex items-center justify-between px-4 py-2 w-full h-14">
      {/* Left: Navigation & Sidebar Toggle */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => updateSession({ isSidebarOpen: !session.isSidebarOpen })}
          title="Toggle Sidebar"
          className="text-muted-foreground hover:text-foreground"
        >
          <SidebarIcon className="size-5" />
        </Button>
        <div className="h-4 w-px bg-border mx-1" />
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Exit Reader</span>
          </Button>
        </Link>
      </div>

      {/* Center: Document Title & Current Heading */}
      <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-4 text-center">
        <h1 className="text-sm font-semibold truncate w-full max-w-md">{document.title}</h1>
        <p className="text-xs text-muted-foreground truncate w-full max-w-sm">{currentHeading}</p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <TypographySettings />
        
        <Button 
          variant={session.focusMode ? 'default' : 'ghost'} 
          size="icon"
          onClick={() => updateSession({ focusMode: !session.focusMode })}
          title="Focus Mode (Hide distractions)"
        >
          <Focus className="size-5" />
        </Button>
        
        {/* Fullscreen placeholder */}
        <Button variant="ghost" size="icon" title="Enter Fullscreen">
          <Maximize className="size-5" />
        </Button>
      </div>
    </div>
  );
}
