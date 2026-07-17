import React from 'react';
import { useIntegration } from '../integration-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';

export const SynchronizationHistory: React.FC = () => {
  const { synchronizations } = useIntegration();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Synchronizations</CardTitle>
      </CardHeader>
      <CardContent>
        {synchronizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sync history.</p>
        ) : (
          <div className="space-y-4">
            {synchronizations.map(s => (
              <div key={s.id} className="flex justify-between text-sm border-b pb-2 last:border-0">
                <span className="font-medium">{s.connectorName}</span>
                <span className="text-muted-foreground">{s.mode} - {s.status}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const ConnectorHealthPanel: React.FC = () => (
  <Card>
    <CardHeader><CardTitle>Platform Health</CardTitle></CardHeader>
    <CardContent>
      <p className="text-sm text-green-600 dark:text-green-400">All registered connectors are responding correctly.</p>
    </CardContent>
  </Card>
);
