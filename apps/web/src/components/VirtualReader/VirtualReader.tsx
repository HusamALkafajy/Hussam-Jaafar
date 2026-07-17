import React, { useRef, UIEvent } from 'react';
import { VirtualReaderProps } from './types';
import { useVirtualReader } from './useVirtualReader';
import { VirtualReaderNode } from './VirtualReaderNode';

export const VirtualReader: React.FC<VirtualReaderProps> = ({ documentId, rootNodeId, config = {}, className }) => {
  const { nodes, isLoading, error, onScroll } = useVirtualReader({ documentId, rootNodeId, config });
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const offset = target.scrollTop;
    const maxScroll = target.scrollHeight - target.clientHeight;
    onScroll(offset, maxScroll);
  };

  if (error) {
    return (
      <div className="virtual-reader-error" role="alert">
        <p>Failed to load document.</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div 
      className={`virtual-reader-container ${className || ''}`}
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        height: '100vh',
        overflowY: 'auto',
        position: 'relative',
        backgroundColor: '#f9f9f9',
        padding: '20px'
      }}
      role="region"
      aria-label="Document Reader"
    >
      <div className="virtual-reader-viewport">
        {nodes.map(node => (
          // Critical constraint: MUST use Canonical UUID for React Key. Never use array index.
          <VirtualReaderNode key={node.id} node={node} />
        ))}
        
        {isLoading && (
          <div className="virtual-reader-loading" aria-busy="true">
            <p>Loading more content...</p>
          </div>
        )}
        
        {!isLoading && nodes.length === 0 && (
          <div className="virtual-reader-empty">
            <p>This document has no content yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
