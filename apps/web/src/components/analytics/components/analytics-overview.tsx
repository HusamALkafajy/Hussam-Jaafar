import React from 'react';
import { useAnalytics } from '../analytics-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Activity, Target, BrainCircuit, Clock } from 'lucide-react';

export const AnalyticsOverview: React.FC = () => {
  const { snapshot } = useAnalytics();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Study Streak</p>
            <Activity className="h-4 w-4 text-orange-500" />
          </div>
          <div className="flex items-center justify-between mt-4">
            <h2 className="text-3xl font-bold">{snapshot.studyTime.streakDays}</h2>
            <p className="text-xs text-muted-foreground">days</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Progress Score</p>
            <Target className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-center justify-between mt-4">
            <h2 className="text-3xl font-bold">{Math.round(snapshot.progress.overallCompletionRate * 100)}%</h2>
            <p className="text-xs text-muted-foreground">overall</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Avg. Retention</p>
            <BrainCircuit className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex items-center justify-between mt-4">
            <h2 className="text-3xl font-bold">{Math.round(snapshot.retention.averageRevisionAccuracy * 100)}%</h2>
            <p className="text-xs text-muted-foreground">accuracy</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Study Time</p>
            <Clock className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-center justify-between mt-4">
            <h2 className="text-3xl font-bold">{Math.round(snapshot.studyTime.totalSeconds / 60)}</h2>
            <p className="text-xs text-muted-foreground">mins</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
