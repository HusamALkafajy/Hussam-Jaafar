'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { WorkflowManager } from '@studyai/domain/workflow/core/workflow-manager';
import { WorkflowCommandBus } from '@studyai/domain/workflow/cqrs/workflow-command-bus';
import { WorkflowExecutor } from '@studyai/domain/workflow/core/workflow-executor';
import { JobQueue } from '@studyai/domain/workflow/job/job-queue';
import { WorkflowViewModel } from '@studyai/domain/workflow/core/workflow-view-models';

interface WorkflowContextValue {
  workflows: WorkflowViewModel[];
  startDemoWorkflow: () => void;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [commandBus] = useState(() => new WorkflowCommandBus());
  const [jobQueue] = useState(() => new JobQueue());
  const [executor] = useState(() => new WorkflowExecutor(jobQueue));
  const [manager] = useState(() => new WorkflowManager(commandBus, executor));
  const [workflows, setWorkflows] = useState<WorkflowViewModel[]>([]);



  useEffect(() => {
    // Setup a demo definition
    manager.registerDefinition({
      id: 'def_demo_1',
      name: 'Document Processing Pipeline',
      initialStepId: 'step_extract',
      steps: {
        'step_extract': {
          id: 'step_extract',
          jobDefinition: { id: 'job_def_1', name: 'Extract Text' },
          nextStepIds: ['step_embed']
        },
        'step_embed': {
          id: 'step_embed',
          jobDefinition: { id: 'job_def_2', name: 'Generate Embeddings' },
          nextStepIds: []
        }
      }
    });
  }, [manager]);

  const startDemoWorkflow = useCallback(async () => {
    await commandBus.dispatch({
      type: 'StartWorkflowCommand',
      timestamp: new Date().toISOString(),
      definitionId: 'def_demo_1'
    });
    setWorkflows(
      manager.getAllInstances().map(inst => ({
        id: inst.id,
        name: inst.definition.name,
        status: inst.status,
        currentStep: inst.currentStepId,
      }))
    );
  }, [commandBus, manager]);

  const value = useMemo(() => ({
    workflows,
    startDemoWorkflow
  }), [workflows, startDemoWorkflow]);

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) throw new Error('useWorkflow must be used within WorkflowProvider');
  return context;
}
