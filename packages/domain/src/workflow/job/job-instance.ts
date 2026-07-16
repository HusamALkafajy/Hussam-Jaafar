import { JobDefinition, JobStatus, JobResult, JobHistoryEvent } from './job-types';

export class JobInstance {
  private _status: JobStatus = 'Queued';
  private _history: JobHistoryEvent[] = [];
  private _result?: JobResult;

  constructor(
    public readonly id: string,
    public readonly workflowId: string,
    public readonly definition: JobDefinition,
    public readonly inputPayload?: any
  ) {
    this.recordState('Queued');
  }

  get status() { return this._status; }
  get history() { return [...this._history]; }
  get result() { return this._result; }

  private recordState(newStatus: JobStatus) {
    this._status = newStatus;
    this._history.push({
      status: newStatus,
      timestamp: new Date().toISOString()
    });
  }

  start() {
    if (this._status !== 'Queued') throw new Error(`Cannot start job from ${this._status}`);
    this.recordState('Running');
  }

  complete(result: JobResult) {
    if (this._status !== 'Running') throw new Error(`Cannot complete job from ${this._status}`);
    this._result = result;
    this.recordState(result.success ? 'Completed' : 'Failed');
  }

  cancel() {
    if (this._status === 'Completed' || this._status === 'Failed') return;
    this.recordState('Cancelled');
  }

  timeout() {
    if (this._status !== 'Running') return;
    this.recordState('TimedOut');
  }
}
