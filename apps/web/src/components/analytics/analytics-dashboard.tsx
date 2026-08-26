'use client';

import React from 'react';
import { AnalyticsOverview } from './components/analytics-overview';
import { InsightsPanel } from './components/insights-panel';

export const AnalyticsDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Learning Analytics</h1>
            <p className="text-muted-foreground mt-1">Read-only overview of your progress and performance.</p>
          </div>
        </header>

        <AnalyticsOverview />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Charts will go here */}
            <div className="h-64 border rounded-xl border-dashed flex items-center justify-center text-muted-foreground bg-slate-100/50 dark:bg-slate-900/50">
              [Progress Chart Placeholder]
            </div>
            <div className="h-64 border rounded-xl border-dashed flex items-center justify-center text-muted-foreground bg-slate-100/50 dark:bg-slate-900/50">
              [Retention Chart Placeholder]
            </div>
          </div>
          <div>
            <InsightsPanel />
          </div>
        </div>
      </div>
    </div>
  );
};
