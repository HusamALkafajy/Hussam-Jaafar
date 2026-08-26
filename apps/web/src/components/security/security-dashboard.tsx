'use client';

import React from 'react';
import { PermissionMatrix } from './components/permission-matrix';
import { AuditTimeline, CompliancePanel } from './components/security-panels';

export const SecurityDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security & Governance</h1>
            <p className="text-muted-foreground mt-1">Centralized authorization, policies, and immutable auditing.</p>
          </div>
        </header>

        <PermissionMatrix />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <AuditTimeline />
          <CompliancePanel />
        </div>
      </div>
    </div>
  );
};
