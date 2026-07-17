import React from 'react';
import { useIntegration } from '../integration-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { PlusCircle, Link as LinkIcon, RefreshCw, ServerCrash } from 'lucide-react';
import { Button } from '../../ui/button';

export const ConnectorCatalog: React.FC = () => {
  const { connectors } = useIntegration();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Connected Integrations</CardTitle>
        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/> Browse Catalog</Button>
      </CardHeader>
      <CardContent>
        {connectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No integrations connected.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {connectors.map(c => (
              <div key={c.id} className="p-4 border rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{c.displayName}</h4>
                    <p className="text-xs text-muted-foreground">{c.capabilities.join(', ')}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {c.healthStatus === 'healthy' ? (
                    <span className="flex h-2 w-2 bg-green-500 rounded-full"></span>
                  ) : (
                    <ServerCrash className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">{c.state}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
