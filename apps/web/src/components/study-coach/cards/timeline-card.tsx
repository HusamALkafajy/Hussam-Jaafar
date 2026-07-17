import React from 'react';
import { CoachCardProps } from '../coach-card-registry';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Activity } from 'lucide-react';
import { TimelineEvent } from '@studyai/domain/adaptive/learning-timeline';

export const TimelineCard: React.FC<CoachCardProps> = ({ insight }) => {
  const events: TimelineEvent[] = insight.payload?.events || [];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5 text-purple-500" />
          {insight.title}
        </CardTitle>
        <CardDescription>{insight.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            events.slice(0, 5).map((evt) => (
              <div key={evt.id} className="flex items-start gap-4">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium">{evt.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(evt.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
