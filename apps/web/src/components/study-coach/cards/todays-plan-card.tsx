import React from 'react';
import { CoachCardProps } from '../coach-card-registry';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Clock, BookOpen, Repeat } from 'lucide-react';

export const TodaysPlanCard: React.FC<CoachCardProps> = ({ insight }) => {
  const { duration, newAssets, reviews } = insight.payload || {};

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="w-5 h-5 text-primary" />
          {insight.title}
        </CardTitle>
        <CardDescription>{insight.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <Clock className="w-6 h-6 mb-2 text-blue-500" />
          <span className="text-2xl font-bold">{Math.round((duration || 0) / 60)}</span>
          <span className="text-xs text-muted-foreground">Minutes</span>
        </div>
        <div className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <BookOpen className="w-6 h-6 mb-2 text-green-500" />
          <span className="text-2xl font-bold">{newAssets || 0}</span>
          <span className="text-xs text-muted-foreground">New Items</span>
        </div>
        <div className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <Repeat className="w-6 h-6 mb-2 text-orange-500" />
          <span className="text-2xl font-bold">{reviews || 0}</span>
          <span className="text-xs text-muted-foreground">Reviews</span>
        </div>
      </CardContent>
    </Card>
  );
};
