'use client';

import React from 'react';
import { useLearningWorkspace } from './learning-workspace-provider';
import { Activity } from 'lucide-react';

export function MetricsPanel() {
  const { learning } = useLearningWorkspace();
  const metrics = learning.metrics;

  if (!metrics) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Activity className="w-4 h-4 text-primary" />
        Learning Metrics
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-muted/50 p-2 rounded-md">
          <div className="text-muted-foreground text-xs">Assets Generated</div>
          <div className="font-medium">{metrics.assetsGenerated}</div>
        </div>
        <div className="bg-muted/50 p-2 rounded-md">
          <div className="text-muted-foreground text-xs">Reviewed</div>
          <div className="font-medium">{metrics.assetsReviewed}</div>
        </div>
        <div className="bg-muted/50 p-2 rounded-md">
          <div className="text-muted-foreground text-xs">Mastery</div>
          <div className="font-medium">{Math.round(metrics.masteryScore * 100)}%</div>
        </div>
        <div className="bg-muted/50 p-2 rounded-md">
          <div className="text-muted-foreground text-xs">Study Time</div>
          <div className="font-medium">{Math.round(metrics.sessionDurationSeconds / 60)}m</div>
        </div>
      </div>
    </div>
  );
}
