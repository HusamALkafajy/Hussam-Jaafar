import React, { useRef, useEffect } from 'react';
import { useReaderState } from './reader-state';
import { VirtualReader } from '../VirtualReader/VirtualReader';
import { SelectionToolbar } from './selection-toolbar';
import { FTUEAISummary } from '../onboarding/ftue-ai-summary';

export function ReaderContainer() {
  const { document, session, setReadingProgress, updateSession } = useReaderState();
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate progress based on scroll in the virtual reader
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const progress = (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100;
    setReadingProgress(Math.min(100, Math.max(0, progress)));
    
    // In a real implementation, we would debounce this and update session.scrollPosition
    // updateSession({ scrollPosition: target.scrollTop });
  };

  return (
    <div 
      className="relative w-full h-full flex justify-center bg-muted/5"
      ref={containerRef}
    >
      <SelectionToolbar />
      
      {/* The actual reading column */}
      <div 
        className="h-full bg-background shadow-sm border-x transition-all duration-300 relative"
        style={{
          width: 'var(--reader-width)',
          maxWidth: '100%',
        }}
      >
        <VirtualReader 
          documentId={document.id}
          rootNodeId={session.currentNodeId || ''}
          className="reader-typography-context !h-full !p-8 md:!px-16"
          config={{
            windowSize: 15
          }}
        />
        
        {/* Absolute Overlay: Will not affect VirtualReader height/scroll */}
        <FTUEAISummary />
        
        {/* We need to intercept the scroll event from the VirtualReader if possible, 
            or use a wrapper. Since VirtualReader handles its own scroll, we would normally 
            pass a callback. Since we can't change VirtualReader, we assume it fills the height 
            and we'll attach a listener in an effect if needed. */}
      </div>
    </div>
  );
}
