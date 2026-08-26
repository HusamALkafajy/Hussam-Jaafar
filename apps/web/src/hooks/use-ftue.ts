'use client';

import { useState, useEffect } from 'react';

// Define the shape of our FTUE state
export interface FTUEState {
  hasUploadedDocument: boolean;
  hasSeenSummary: boolean;
  hasSeenChatTooltip: boolean;
  hasGeneratedFlashcards: boolean;
  hasStartedQuiz: boolean;
  hasSeenStudyPlanPrompt: boolean;
  hasSeenTokenAnchor: boolean;
}

const DEFAULT_STATE: FTUEState = {
  hasUploadedDocument: false,
  hasSeenSummary: false,
  hasSeenChatTooltip: false,
  hasGeneratedFlashcards: false,
  hasStartedQuiz: false,
  hasSeenStudyPlanPrompt: false,
  hasSeenTokenAnchor: false,
};

const FTUE_STORAGE_KEY = 'studyai_ftue_state_v1';

export function useFTUE() {
  const [ftueState, setFtueState] = useState<FTUEState>(DEFAULT_STATE);
  const [isReady, setIsReady] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FTUE_STORAGE_KEY);
      if (stored) {
        setFtueState({ ...DEFAULT_STATE, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.warn('Failed to load FTUE state', e);
    } finally {
      setIsReady(true);
    }
  }, []);

  // Update specific key
  const markAsSeen = (key: keyof FTUEState) => {
    setFtueState(prev => {
      const next = { ...prev, [key]: true };
      try {
        localStorage.setItem(FTUE_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save FTUE state', e);
      }
      return next;
    });
  };

  // Reset for testing
  const resetFTUE = () => {
    setFtueState(DEFAULT_STATE);
    try {
      localStorage.removeItem(FTUE_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  };

  return {
    state: ftueState,
    isReady,
    markAsSeen,
    resetFTUE,
  };
}
