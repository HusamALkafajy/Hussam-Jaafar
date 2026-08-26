import React from 'react';
import { useReaderState } from './reader-state';
import { DocumentOutlineNode } from '../../mocks/workspace/outline';
import { cn } from '../../lib/utils';
import { ChevronRight, ChevronDown, Circle } from 'lucide-react';

export function OutlineTree() {
  const { outline, session, updateSession } = useReaderState();
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNodeClick = (nodeId: string) => {
    // Scroll logic will be handled by listening to session.currentNodeId changes
    // or by imperative ref calls in the container. For now, just update state.
    updateSession({ currentNodeId: nodeId });
  };

  const renderNode = (node: DocumentOutlineNode) => {
    const isCurrent = session.currentNodeId === node.nodeId;
    const isExpanded = expanded[node.id] !== false; // Default expanded
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="flex flex-col">
        <div 
          className={cn(
            "flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors",
            isCurrent ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
          style={{ paddingInlineStart: `${node.level * 12}px` }}
        >
          {hasChildren ? (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
              aria-label={isExpanded ? `Collapse ${node.title}` : `Expand ${node.title}`}
              className="p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground"
            >
              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <div className="size-4.5 flex items-center justify-center">
              <Circle className="size-1.5 fill-current opacity-40" />
            </div>
          )}
          
          <span 
            className="flex-1 truncate" 
            onClick={() => handleNodeClick(node.nodeId)}
          >
            {node.title}
          </span>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="flex flex-col mt-0.5">
            {node.children!.map(renderNode)}
          </div>
        )}
      </div>
    );
  };

  if (!outline.length) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No outline available for this document.
      </div>
    );
  }

  return (
    <div className="flex flex-col py-2 px-3 gap-0.5 overflow-y-auto">
      {outline.map(renderNode)}
    </div>
  );
}
