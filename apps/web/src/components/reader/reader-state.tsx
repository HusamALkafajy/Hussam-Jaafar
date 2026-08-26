'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ReaderSession, DEFAULT_SESSION } from '../../mocks/workspace/reader-session';
import { Bookmark, MOCK_BOOKMARKS } from '../../mocks/workspace/bookmarks';
import { Highlight, MOCK_HIGHLIGHTS } from '../../mocks/workspace/highlights';
import { DocumentOutlineNode, MOCK_DOCUMENT_OUTLINE } from '../../mocks/workspace/outline';
import { ReaderDocumentInfo, MOCK_READER_DOC } from '../../mocks/workspace/reader';

type ReaderInitializationState = 'idle' | 'loading-bootstrap' | 'processing' | 'empty' | 'ready' | 'not-found' | 'forbidden' | 'error';

interface ReaderStateContextType {
  // Document Data
  documentId: string;
  versionId: string | null;
  initStatus: ReaderInitializationState;
  
  // Document Data (mock fallbacks for UI)
  document: any;
  outline: any[];
  
  // Session State
  session: ReaderSession;
  updateSession: (updates: Partial<ReaderSession>) => void;
  
  // Progress
  readingProgress: number; // 0-100
  setReadingProgress: (progress: number) => void;
  
  // Local Data (Bookmarks, Highlights)
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (id: string) => void;
  
  highlights: Highlight[];
  addHighlight: (highlight: Highlight) => void;
  removeHighlight: (id: string) => void;
  
  // UI State
  selectedText: string | null;
  setSelectedText: (text: string | null) => void;
}

const ReaderStateContext = createContext<ReaderStateContextType | null>(null);

export const useReaderState = () => {
  const context = useContext(ReaderStateContext);
  if (!context) {
    throw new Error('useReaderState must be used within a ReaderStateProvider');
  }
  return context;
};

export const ReaderStateProvider: React.FC<{
  documentId: string;
  children: React.ReactNode;
}> = ({ documentId, children }) => {
  const [initStatus, setInitStatus] = useState<ReaderInitializationState>('idle');
  const [versionId, setVersionId] = useState<string | null>(null);

  // Load session from local storage or use default
  const [session, setSession] = useState<ReaderSession>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`reader_session_${documentId}`);
      if (stored) {
        try {
          return { ...DEFAULT_SESSION, ...JSON.parse(stored), documentId };
        } catch (e) {
          console.error("Failed to parse stored reader session", e);
        }
      }
    }
    return { ...DEFAULT_SESSION, documentId };
  });

  const [readingProgress, setReadingProgress] = useState(0);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(MOCK_BOOKMARKS);
  const [highlights, setHighlights] = useState<Highlight[]>(MOCK_HIGHLIGHTS);
  const [selectedText, setSelectedText] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrapReader() {
      setInitStatus('loading-bootstrap');
      try {
        const res = await fetch(`/api/documents/files/${documentId}/bootstrap`);
        if (res.status === 404) {
          if (mounted) setInitStatus('not-found');
          return;
        }
        if (res.status === 401 || res.status === 403) {
          if (mounted) setInitStatus('forbidden');
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to bootstrap reader');
        }

        const data = await res.json();
        
        if (!mounted) return;

        setVersionId(data.versionId);

        if (data.status === 'processing') {
          setInitStatus('processing');
        } else if (data.status === 'failed') {
          setInitStatus('error');
        } else if (data.status === 'completed') {
          // If we have roots, we are ready. If no roots, it's a legitimately empty document (AST not extracted)
          if (data.roots && data.roots.length > 0) {
             setInitStatus('ready');
             // Initialize root if session has no node
             setSession(prev => {
                if (!prev.currentNodeId) {
                   return { ...prev, currentNodeId: data.roots[0].id };
                }
                return prev;
             });
          } else {
             setInitStatus('empty');
          }
        } else {
          setInitStatus('error');
        }

      } catch (err) {
        if (mounted) {
           console.error(err);
           setInitStatus('error');
        }
      }
    }

    bootstrapReader();

    return () => { mounted = false; };
  }, [documentId]);

  // Persist session changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`reader_session_${documentId}`, JSON.stringify(session));
    }
  }, [session, documentId]);

  const updateSession = (updates: Partial<ReaderSession>) => {
    setSession(prev => ({ ...prev, ...updates }));
  };

  const addBookmark = (bookmark: Bookmark) => setBookmarks(prev => [...prev, bookmark]);
  const removeBookmark = (id: string) => setBookmarks(prev => prev.filter(b => b.id !== id));
  
  const addHighlight = (highlight: Highlight) => setHighlights(prev => [...prev, highlight]);
  const removeHighlight = (id: string) => setHighlights(prev => prev.filter(h => h.id !== id));

  return (
    <ReaderStateContext.Provider value={{
      documentId,
      versionId,
      initStatus,
      document: MOCK_READER_DOC,
      outline: MOCK_DOCUMENT_OUTLINE,
      session,
      updateSession,
      readingProgress,
      setReadingProgress,
      bookmarks,
      addBookmark,
      removeBookmark,
      highlights,
      addHighlight,
      removeHighlight,
      selectedText,
      setSelectedText
    }}>
      <div 
        // Apply typography CSS variables globally for the reader context
        style={{
          '--reader-font-size': session.fontSize === 'small' ? '14px' : session.fontSize === 'large' ? '20px' : session.fontSize === 'xlarge' ? '24px' : '16px',
          '--reader-line-height': session.lineHeight === 'tight' ? '1.4' : session.lineHeight === 'relaxed' ? '1.8' : '1.6',
          '--reader-font-family': session.fontFamily === 'serif' ? 'ui-serif, Georgia, serif' : 'ui-sans-serif, system-ui, sans-serif',
          '--reader-width': session.readingWidth === 'narrow' ? '600px' : session.readingWidth === 'wide' ? '1000px' : '800px',
        } as React.CSSProperties}
        className={`h-full ${session.theme === 'dark' ? 'dark' : ''} ${session.theme === 'sepia' ? 'sepia-theme' : ''}`}
      >
        {children}
      </div>
    </ReaderStateContext.Provider>
  );
};
