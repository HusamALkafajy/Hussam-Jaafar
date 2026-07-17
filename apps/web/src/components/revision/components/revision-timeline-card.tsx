import React from 'react';
import { useRevision } from '../revision-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Activity } from 'lucide-react';

export const RevisionTimelineCard: React.FC = () => {
  const { timeline, tick } = useRevision();

  const events = [...timeline.getEvents()].reverse();

  if (events.length === 0) return null;

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5 text-purple-500" />
          Revision Timeline Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[300px] overflow-y-auto">
          {events.map((evt) => (
            <div key={evt.id} className="flex items-start gap-4">
              <div className="w-2 h-2 mt-2 rounded-full bg-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{evt.type}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </p>
                {evt.payload && (
                  <pre className="text-[10px] mt-1 bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
