'use client';

import React from 'react';
import { ConnectorCatalog } from './components/connector-catalog';
import { SynchronizationHistory, ConnectorHealthPanel } from './components/connector-panels';

export const IntegrationDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Integration Platform</h1>
            <p className="text-muted-foreground mt-1">Manage plugins, external providers, and synchronization flows.</p>
          </div>
        </header>

        <ConnectorCatalog />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <SynchronizationHistory />
          <ConnectorHealthPanel />
        </div>
      </div>
    </div>
  );
};
