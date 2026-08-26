'use client';

import React from 'react';
import { WorkflowOverview } from './components/workflow-overview';
import { WorkflowList, JobQueuePanel, JobHistoryPanel } from './components/workflow-panels';

export const WorkflowDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Workflows</h1>
            <p className="text-muted-foreground mt-1">Operational view of background jobs and processes.</p>
          </div>
        </header>

        <WorkflowOverview />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <WorkflowList />
          </div>
          <div className="space-y-8">
            <JobQueuePanel />
            <JobHistoryPanel />
          </div>
        </div>
      </div>
    </div>
  );
};
