import React from 'react';
import { useWorkflow } from '../workflow-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Activity, Play, CheckCircle, Clock } from 'lucide-react';

export const WorkflowOverview: React.FC = () => {
  const { workflows } = useWorkflow();

  const active = workflows.filter(w => w.status === 'Running' || w.status === 'Queued').length;
  const completed = workflows.filter(w => w.status === 'Completed').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Active Workflows</p>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-center justify-between mt-4">
            <h2 className="text-3xl font-bold">{active}</h2>
            <p className="text-xs text-muted-foreground">running/queued</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-center justify-between mt-4">
            <h2 className="text-3xl font-bold">{completed}</h2>
            <p className="text-xs text-muted-foreground">success</p>
          </div>
        </CardContent>
      </Card>
      
      {/* Pending jobs, failed jobs, etc. can go here */}
    </div>
  );
};
