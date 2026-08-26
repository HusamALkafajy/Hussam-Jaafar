'use client';

import React, { useEffect, useState } from 'react';
import { useRevision } from './revision-provider';
import { RevisionLayout } from './components/revision-layout';
import { RevisionQueuePanel } from './components/revision-queue-panel';
import { RevisionCard } from './components/revision-card';
import { RevisionProgress } from './components/revision-progress';
import { RevisionSummaryCard } from './components/revision-summary-card';
import { RevisionTimelineCard } from './components/revision-timeline-card';

export const RevisionWorkspace: React.FC = () => {
  const { isSessionActive, session, tick } = useRevision();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <RevisionLayout>
      <div className="w-full max-w-4xl mx-auto space-y-8 pb-16">
        {!isSessionActive && (!session || session.status === 'NotStarted') && (
          <RevisionQueuePanel />
        )}
        
        {isSessionActive && (
          <>
            <RevisionProgress />
            <RevisionCard />
          </>
        )}

        {session?.status === 'Completed' && (
          <RevisionSummaryCard />
        )}

        <RevisionTimelineCard />
      </div>
    </RevisionLayout>
  );
};
