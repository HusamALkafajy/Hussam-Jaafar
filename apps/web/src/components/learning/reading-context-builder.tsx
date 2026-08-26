'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useReaderState } from '../reader/reader-state';
import { useSelectionState } from './selection-state';
import { ReadingContext } from '../../mocks/workspace/reading-context';
import { DocumentOutlineNode } from '../../mocks/workspace/outline';

interface ReadingContextBuilderContextType {
  readingContext: ReadingContext;
}

const ReadingContextBuilderContext = createContext<ReadingContextBuilderContextType | null>(null);

export const useReadingContext = () => {
  const context = useContext(ReadingContextBuilderContext);
  if (!context) throw new Error('useReadingContext must be used within ReadingContextBuilderProvider');
  return context;
};

// Helper to find breadcrumbs
function getBreadcrumbs(outline: DocumentOutlineNode[], targetNodeId: string): { id: string, label: string }[] {
  let path: { id: string, label: string }[] = [];
  
  const search = (nodes: DocumentOutlineNode[], currentPath: { id: string, label: string }[]): boolean => {
    for (const node of nodes) {
      const newPath = [...currentPath, { id: node.nodeId, label: node.title }];
      if (node.nodeId === targetNodeId) {
        path = newPath;
        return true;
      }
      if (node.children && search(node.children, newPath)) {
        return true;
      }
    }
    return false;
  };
  
  search(outline, []);
  return path;
}

export const ReadingContextBuilderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { document, outline, session, readingProgress, bookmarks, highlights } = useReaderState();
  const { selection } = useSelectionState();

  const readingContext = useMemo<ReadingContext>(() => {
    const currentNodeId = session.currentNodeId || '';
    const breadcrumbs = getBreadcrumbs(outline, currentNodeId);
    
    // Derived context
    const hierarchy = breadcrumbs.map(b => b.label);
    const chapter = hierarchy[0] || null;
    const section = hierarchy[1] || null;
    const heading = hierarchy[hierarchy.length - 1] || null;

    return {
      documentId: document.id,
      documentTitle: document.title,
      chapter,
      section,
      heading,
      hierarchy,
      breadcrumbs,
      currentNode: currentNodeId,
      previousNodes: [], // Mock placeholder
      nextNodes: [],     // Mock placeholder
      sectionStart: breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].id : null,
      sectionEnd: null,
      visibleWindow: [currentNodeId], // Mock
      selectedText: selection.text,
      readerProgress: readingProgress,
      bookmarks,
      highlights
    };
  }, [document, outline, session.currentNodeId, selection.text, readingProgress, bookmarks, highlights]);

  return (
    <ReadingContextBuilderContext.Provider value={{ readingContext }}>
      {children}
    </ReadingContextBuilderContext.Provider>
  );
};
