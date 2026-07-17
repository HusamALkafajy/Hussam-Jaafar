import React from 'react';
import { useAnalytics } from '../analytics-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';

export const InsightsPanel: React.FC = () => {
  const { insights } = useAnalytics();

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No insights available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight) => (
          <div 
            key={insight.id} 
            className={`p-4 rounded-lg border ${
              insight.severity === 'High' ? 'bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900' :
              insight.severity === 'Medium' ? 'bg-orange-50 border-orange-100 dark:bg-orange-950/20 dark:border-orange-900' :
              'bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-sm">{insight.title}</h4>
              <span className="text-xs font-medium px-2 py-1 rounded bg-white dark:bg-slate-900 shadow-sm">
                {insight.category}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
            {insight.recommendation && (
              <div className="text-sm font-medium border-t pt-2 mt-2">
                Action: {insight.recommendation}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
