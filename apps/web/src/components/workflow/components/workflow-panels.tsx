import React from 'react';
import { useWorkflow } from '../workflow-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';

export const WorkflowList: React.FC = () => {
  const { workflows, startDemoWorkflow } = useWorkflow();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Active Workflows</CardTitle>
        <Button onClick={startDemoWorkflow} size="sm">Start Demo Workflow</Button>
      </CardHeader>
      <CardContent>
        {workflows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workflows running.</p>
        ) : (
          <div className="space-y-4">
            {workflows.map(wf => (
              <div key={wf.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <h4 className="font-medium text-sm">{wf.name}</h4>
                  <p className="text-xs text-muted-foreground">ID: {wf.id} • Step: {wf.currentStep || 'Finished'}</p>
                </div>
                <div className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                  {wf.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Placeholders for other required components
export const WorkflowTimeline: React.FC = () => <div className="p-4 border rounded">Timeline</div>;
export const JobQueuePanel: React.FC = () => <div className="p-4 border rounded">Job Queue</div>;
export const JobHistoryPanel: React.FC = () => <div className="p-4 border rounded">Job History</div>;
