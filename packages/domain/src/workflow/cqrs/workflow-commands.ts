export type WorkflowCommandType = 
  | 'StartWorkflowCommand'
  | 'PauseWorkflowCommand'
  | 'ResumeWorkflowCommand'
  | 'CancelWorkflowCommand'
  | 'RetryWorkflowCommand';

export interface BaseCommand {
  type: WorkflowCommandType;
  timestamp: string;
}

export interface StartWorkflowCommand extends BaseCommand {
  type: 'StartWorkflowCommand';
  definitionId: string;
  payload?: any;
}

export interface PauseWorkflowCommand extends BaseCommand {
  type: 'PauseWorkflowCommand';
  workflowId: string;
}

export interface ResumeWorkflowCommand extends BaseCommand {
  type: 'ResumeWorkflowCommand';
  workflowId: string;
}

export interface CancelWorkflowCommand extends BaseCommand {
  type: 'CancelWorkflowCommand';
  workflowId: string;
}

export interface RetryWorkflowCommand extends BaseCommand {
  type: 'RetryWorkflowCommand';
  workflowId: string;
}

export type WorkflowCommand = 
  | StartWorkflowCommand 
  | PauseWorkflowCommand 
  | ResumeWorkflowCommand 
  | CancelWorkflowCommand 
  | RetryWorkflowCommand;
