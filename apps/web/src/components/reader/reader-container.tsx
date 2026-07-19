import React, { useRef } from 'react';
import { useReaderState } from './reader-state';
import { VirtualReader } from '../VirtualReader/VirtualReader';
import { SelectionToolbar } from './selection-toolbar';
import { FTUEAISummary } from '../onboarding/ftue-ai-summary';

export function ReaderContainer() {
  const { initStatus, versionId, session, setReadingProgress } = useReaderState();
  const containerRef = useRef<HTMLDivElement>(null);

  if (initStatus === 'idle' || initStatus === 'loading-bootstrap') {
    return <div className="w-full h-full flex items-center justify-center bg-muted/5">Loading Reader...</div>;
  }

  if (initStatus === 'processing') {
    return <div className="w-full h-full flex items-center justify-center bg-muted/5">Document is processing. Please wait.</div>;
  }

  if (initStatus === 'not-found') {
    return <div className="w-full h-full flex items-center justify-center bg-muted/5">Document not found.</div>;
  }

  if (initStatus === 'forbidden') {
    return <div className="w-full h-full flex items-center justify-center bg-muted/5">Access denied.</div>;
  }

  if (initStatus === 'error') {
    return <div className="w-full h-full flex items-center justify-center bg-muted/5">Failed to load document.</div>;
  }

  if (initStatus === 'empty') {
    return <div className="w-full h-full flex items-center justify-center bg-muted/5">Document has no content yet.</div>;
  }

  return (
    <div 
      className="relative w-full h-full flex justify-center bg-muted/5"
      ref={containerRef}
    >
      <SelectionToolbar />
      
      <div 
        className="h-full bg-background shadow-sm border-x transition-all duration-300 relative"
        style={{
          width: 'var(--reader-width)',
          maxWidth: '100%',
        }}
      >
        <VirtualReader 
          versionId={versionId}
          rootNodeId={session.currentNodeId || ''}
          className="reader-typography-context !h-full !p-8 md:!px-16"
          config={{
            windowSize: 15
          }}
        />
        
        <FTUEAISummary />
      </div>
    </div>
  );
}
