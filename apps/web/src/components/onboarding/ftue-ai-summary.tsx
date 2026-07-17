'use client';

import React, { useState, useEffect } from 'react';
import { useFTUE } from '../../hooks/use-ftue';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Sparkles, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useReaderState } from '../reader/reader-state';

const SUMMARY_TEXT = "This document covers the fundamental principles of behavioral psychology, focusing on classical and operant conditioning. Key takeaways include Pavlov's initial experiments, Skinner's reinforcement schedules, and their applications in modern cognitive therapy.";

export function FTUEAISummary() {
  const { state, isReady, markAsSeen } = useFTUE();
  const { updateSession } = useReaderState();
  const [phase, setPhase] = useState<'generating' | 'streaming' | 'finished' | 'error'>('generating');
  const [streamedText, setStreamedText] = useState('');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!isReady || state.hasSeenSummary || phase !== 'generating') return;

    // Simulate generation delay
    const genTimer = setTimeout(() => {
      // Mock failure on first attempt to satisfy the verification requirement
      if (attempts === 0) {
        setPhase('error');
      } else {
        setPhase('streaming');
      }
    }, 1500);

    return () => clearTimeout(genTimer);
  }, [isReady, state.hasSeenSummary, phase, attempts]);

  useEffect(() => {
    if (phase !== 'streaming') return;

    let i = 0;
    const interval = setInterval(() => {
      if (i < SUMMARY_TEXT.length) {
        setStreamedText(SUMMARY_TEXT.slice(0, i + 1));
        i += 3; // Stream a few chars at a time
      } else {
        clearInterval(interval);
        setPhase('finished');
        // Once finished, ensure sidebar is open so they can see the chat chips (Phase 3)
        updateSession({ isSidebarOpen: true, sidebarTab: 'ai' });
      }
    }, 20);

    return () => clearInterval(interval);
  }, [phase, updateSession]);

  if (!isReady || state.hasSeenSummary) {
    return null;
  }

  const handleDismiss = () => {
    markAsSeen('hasSeenSummary');
  };

  const handleRetry = () => {
    setAttempts(a => a + 1);
    setPhase('generating');
  };

  return (
    <div 
      className="absolute inset-0 z-50 pointer-events-none flex justify-center pt-8 md:pt-12 px-4"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-2xl motion-safe:animate-in motion-safe:slide-in-from-top-4 motion-safe:fade-in duration-500">
        <Card className="border-primary/20 shadow-xl shadow-primary/5 overflow-hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-medium">
              <Sparkles className="w-5 h-5 motion-safe:animate-pulse" />
              <span>Here's what you need to know</span>
            </div>
            {(phase === 'finished' || phase === 'error') && (
              <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
                <span className="sr-only">Dismiss</span>
              </Button>
            )}
          </div>
          
          <div className="p-6">
            {phase === 'generating' && (
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded motion-safe:animate-pulse w-3/4"></div>
                <div className="h-4 bg-muted rounded motion-safe:animate-pulse w-full"></div>
                <div className="h-4 bg-muted rounded motion-safe:animate-pulse w-5/6"></div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-4">
                  <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin"></div>
                  Analyzing document structure...
                </div>
              </div>
            )}

            {phase === 'error' && (
              <div className="space-y-4">
                <div className="h-4 bg-muted/50 rounded w-3/4"></div>
                <div className="h-4 bg-muted/50 rounded w-full"></div>
                <div className="h-4 bg-muted/50 rounded w-5/6"></div>
                <div className="flex items-center justify-between pt-4 border-t border-border/50 motion-safe:animate-in motion-safe:fade-in duration-500">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    <span>Generation failed</span>
                  </div>
                  <Button variant="outline" onClick={handleRetry}>
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {(phase === 'streaming' || phase === 'finished') && (
              <div className="space-y-4">
                <p className="text-sm md:text-base leading-relaxed text-foreground min-h-[80px]">
                  {streamedText}
                  {phase === 'streaming' && <span className="inline-block w-1.5 h-4 ml-1 bg-primary motion-safe:animate-pulse align-middle" />}
                </p>
                
                {phase === 'finished' && (
                  <div className="flex items-center justify-between pt-4 border-t border-border/50 motion-safe:animate-in motion-safe:fade-in duration-500">
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Summary complete</span>
                    </div>
                    <Button onClick={handleDismiss}>
                      Got it
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
