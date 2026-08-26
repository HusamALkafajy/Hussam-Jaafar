import { RetryPolicy, TimeoutPolicy, FailurePolicy } from '../policies/workflow-policies';
import { JobDefinition } from '../job/job-types';

export interface WorkflowStep {
  readonly id: string;
  readonly jobDefinition: JobDefinition;
  readonly nextStepIds: string[];
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly initialStepId: string;
  readonly steps: Record<string, WorkflowStep>;
  
  // Optional policies
  readonly defaultRetryPolicy?: RetryPolicy;
  readonly defaultTimeoutPolicy?: TimeoutPolicy;
  readonly defaultFailurePolicy?: FailurePolicy;
}
