import React from 'react';
import { CoachCardProps } from '../coach-card-registry';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { TrendingUp } from 'lucide-react';
import { Progress } from '../../ui/progress';

export const ProgressOverview: React.FC<CoachCardProps> = ({ insight }) => {
  const { progress } = insight.payload || { progress: 0 };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          {insight.title}
        </CardTitle>
        <CardDescription>{insight.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={progress * 100} className="h-2 mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress * 100)}% Complete</span>
          <span>Keep going!</span>
        </div>
      </CardContent>
    </Card>
  );
};
