import { WorkflowState } from './workflow-state';
import { WorkflowEvent } from '../cqrs/workflow-events';

export interface WorkflowViewModel {
  readonly id: string;
  readonly name: string;
  readonly status: WorkflowState;
  readonly currentStep: string | null;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export interface WorkflowHistoryViewModel {
  readonly events: WorkflowEvent[];
}
