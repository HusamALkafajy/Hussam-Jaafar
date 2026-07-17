import React from 'react';
import { CoachCardProps } from '../coach-card-registry';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import Link from 'next/link';

export const RecommendationCard: React.FC<CoachCardProps> = ({ insight }) => {
  const rec = insight.payload;

  return (
    <Card className="w-full border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg text-blue-700 dark:text-blue-400">
            <Sparkles className="w-5 h-5" />
            {insight.title}
          </CardTitle>
          <Badge variant="outline" className="text-blue-600 dark:text-blue-400">
            {Math.round((rec?.confidence || 0) * 100)}% Match
          </Badge>
        </div>
        <CardDescription className="text-blue-600/80 dark:text-blue-400/80">
          {insight.description}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Link href={`/learn/${rec?.targetId}`} className="w-full">
          <Button className="w-full gap-2" variant="default">
            Start {rec?.targetType} <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};
