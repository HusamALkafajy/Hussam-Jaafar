import React from 'react';
import { DocumentNode } from './types';

interface VirtualReaderNodeProps {
  node: DocumentNode;
  style?: React.CSSProperties;
}

export const VirtualReaderNode: React.FC<VirtualReaderNodeProps> = React.memo(({ node, style }) => {
  // Use semantic HTML elements based on nodeType for accessibility
  const renderContent = () => {
    switch (node.nodeType) {
      case 'HEADING':
        const level = node.metadata?.level || 2;
        if (level === 1) return <h1>{node.content?.text}</h1>;
        if (level === 2) return <h2>{node.content?.text}</h2>;
        if (level === 3) return <h3>{node.content?.text}</h3>;
        if (level === 4) return <h4>{node.content?.text}</h4>;
        if (level === 5) return <h5>{node.content?.text}</h5>;
        return <h6>{node.content?.text}</h6>;
      case 'PARAGRAPH':
        return <p>{node.content?.text}</p>;
      case 'LIST_ITEM':
        return <li>{node.content?.text}</li>;
      default:
        return <div>{node.content?.text}</div>;
    }
  };

  return (
    <div 
      className="virtual-reader-node"
      style={{
        ...style,
        padding: '12px 16px',
        margin: '4px 0',
        backgroundColor: '#fff',
        borderRadius: '4px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
      data-node-id={node.id} // Helpful for E2E testing and aria-activedescendant
      tabIndex={0} // Accessibility: allow keyboard navigation focus
      role="document"
    >
      {renderContent()}
    </div>
  );
});

VirtualReaderNode.displayName = 'VirtualReaderNode';
