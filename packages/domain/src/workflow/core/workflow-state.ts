export type WorkflowState = 
  | 'Created'
  | 'Queued'
  | 'Running'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'
  | 'TimedOut';
