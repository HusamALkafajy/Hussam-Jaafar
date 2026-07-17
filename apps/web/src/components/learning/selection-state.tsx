'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useReaderState } from '../reader/reader-state';
import { SelectionState } from '../../mocks/workspace/selection-state';
import { internalEvents } from './events';

interface SelectionStateContextType {
  selection: SelectionState;
  clearSelection: () => void;
}

const SelectionStateContext = createContext<SelectionStateContextType | null>(null);

export const useSelectionState = () => {
  const context = useContext(SelectionStateContext);
  if (!context) throw new Error('useSelectionState must be used within SelectionStateProvider');
  return context;
};

export const SelectionStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useReaderState();
  const [selection, setSelection] = useState<SelectionState>({
    text: null,
    nodeId: null,
    range: null,
    timestamp: null
  });

  useEffect(() => {
    const handleSelectionChange = () => {
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.isCollapsed || !domSelection.toString().trim()) {
        if (selection.text !== null) {
          setSelection({ text: null, nodeId: null, range: null, timestamp: null });
        }
        return;
      }
      
      const newSelection: SelectionState = {
        text: domSelection.toString(),
        nodeId: session.currentNodeId || null,
        range: { start: 0, end: domSelection.toString().length }, // Mock range for now
        timestamp: new Date().toISOString()
      };
      
      setSelection(newSelection);
      internalEvents.publish('selection.changed', newSelection);
    };

    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('keyup', handleSelectionChange);
    };
  }, [session.currentNodeId, selection.text]);

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setSelection({ text: null, nodeId: null, range: null, timestamp: null });
  };

  return (
    <SelectionStateContext.Provider value={{ selection, clearSelection }}>
      {children}
    </SelectionStateContext.Provider>
  );
};
