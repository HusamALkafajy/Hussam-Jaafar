import React from 'react';
import { CoachCardProps } from '../coach-card-registry';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Target } from 'lucide-react';
import { Badge } from '../../ui/badge';

export const CurrentGoalCard: React.FC<CoachCardProps> = ({ insight }) => {
  const goal = insight.payload;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="w-5 h-5 text-indigo-500" />
            {insight.title}
          </CardTitle>
          <Badge variant={goal?.priority === 'Critical' ? 'destructive' : 'secondary'}>
            {goal?.priority || 'Normal'}
          </Badge>
        </div>
        <CardDescription>{insight.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Render hierarchical objectives here if present */}
        <div className="text-sm text-muted-foreground">
          {goal?.objectives?.length || 0} active objectives.
        </div>
      </CardContent>
    </Card>
  );
};
