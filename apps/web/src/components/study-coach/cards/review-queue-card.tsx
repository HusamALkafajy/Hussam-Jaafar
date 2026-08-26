import React from 'react';
import { CoachCardProps } from '../coach-card-registry';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Repeat } from 'lucide-react';
import { Button } from '../../ui/button';
import Link from 'next/link';

export const ReviewQueueCard: React.FC<CoachCardProps> = ({ insight }) => {
  const { queue } = insight.payload || { queue: [] };

  if (queue.length === 0) return null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Repeat className="w-5 h-5 text-orange-500" />
          {insight.title}
        </CardTitle>
        <CardDescription>{insight.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          nativeButton={false}
          render={<Link href="/learn/review" />}
          variant="outline"
          className="w-full"
        >
          Start Reviews ({queue.length})
        </Button>
      </CardContent>
    </Card>
  );
};
