import { WorkflowState } from './workflow-state';
import { WorkflowDefinition } from './workflow-definition';
import { WorkflowEvent } from '../cqrs/workflow-events';

export interface WorkflowResult {
  readonly success: boolean;
  readonly outputPayload?: any;
  readonly errorPayload?: any;
}

export class WorkflowInstance {
  private _status: WorkflowState = 'Created';
  private _history: WorkflowEvent[] = [];
  private _currentStepId: string | null = null;
  private _result?: WorkflowResult;

  constructor(
    public readonly id: string,
    public readonly definition: WorkflowDefinition,
    public readonly inputPayload?: any
  ) {
    this._currentStepId = definition.initialStepId;
    this.recordEvent('workflow.created');
  }

  get status() { return this._status; }
  get history() { return [...this._history]; }
  get currentStepId() { return this._currentStepId; }
  get result() { return this._result; }

  private recordEvent(type: WorkflowEvent['type'], payload?: any) {
    this._history.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      workflowId: this.id,
      type,
      timestamp: new Date().toISOString(),
      payload
    });
  }

  queue() {
    if (this._status !== 'Created') throw new Error(`Cannot queue from ${this._status}`);
    this._status = 'Queued';
  }

  start() {
    if (this._status !== 'Queued' && this._status !== 'Paused') throw new Error(`Cannot start from ${this._status}`);
    this._status = 'Running';
    this.recordEvent('workflow.started');
  }

  pause() {
    if (this._status !== 'Running') throw new Error(`Cannot pause from ${this._status}`);
    this._status = 'Paused';
    this.recordEvent('workflow.paused');
  }

  complete(result: WorkflowResult) {
    if (this._status !== 'Running') throw new Error(`Cannot complete from ${this._status}`);
    this._result = result;
    this._status = result.success ? 'Completed' : 'Failed';
    this.recordEvent(result.success ? 'workflow.completed' : 'workflow.failed', result);
  }

  cancel() {
    if (this._status === 'Completed' || this._status === 'Failed') return;
    this._status = 'Cancelled';
    this.recordEvent('workflow.cancelled');
  }

  advanceStep(nextStepId: string) {
    if (this._status !== 'Running') throw new Error('Workflow must be running to advance');
    this._currentStepId = nextStepId;
  }
}
