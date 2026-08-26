export type WorkflowEventType =
  | 'workflow.created'
  | 'workflow.started'
  | 'workflow.paused'
  | 'workflow.resumed'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.cancelled'
  | 'workflow.timed_out'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'job.retried';

export interface WorkflowEvent {
  id: string;
  workflowId: string;
  type: WorkflowEventType;
  timestamp: string;
  payload?: any;
}
