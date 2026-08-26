import { AssessmentResult } from './evaluation/assessment-result';

export type AssessmentStatus = 'NotStarted' | 'InProgress' | 'Paused' | 'Completed';

export interface AnswerPayload {
  questionId: string;
  value: any;
  submittedAt: string;
}

export class AssessmentAttempt {
  private _status: AssessmentStatus = 'NotStarted';
  private _startedAt?: string;
  private _completedAt?: string;
  private _answers: Map<string, AnswerPayload> = new Map();
  private _result?: AssessmentResult;

  constructor(
    public readonly attemptId: string,
    public readonly assessmentId: string,
    public readonly targetAssetIds: string[]
  ) {}

  get status() { return this._status; }
  get startedAt() { return this._startedAt; }
  get completedAt() { return this._completedAt; }
  get answers() { return Array.from(this._answers.values()); }
  get result() { return this._result; }

  start() {
    if (this._status === 'NotStarted') {
      this._status = 'InProgress';
      this._startedAt = new Date().toISOString();
    }
  }

  pause() {
    if (this._status === 'InProgress') {
      this._status = 'Paused';
    }
  }

  resume() {
    if (this._status === 'Paused') {
      this._status = 'InProgress';
    }
  }

  recordAnswer(answer: AnswerPayload) {
    if (this._status !== 'InProgress') return;
    this._answers.set(answer.questionId, answer);
  }

  complete(result: AssessmentResult) {
    this._status = 'Completed';
    this._completedAt = new Date().toISOString();
    this._result = result;
  }
}
