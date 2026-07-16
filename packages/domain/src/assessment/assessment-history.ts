import { AssessmentResult } from './evaluation/assessment-result';

export interface AssessmentHistoryEntry {
  attemptId: string;
  assessmentId: string;
  result: AssessmentResult;
  durationSeconds: number;
}

export class AssessmentHistory {
  private entries: AssessmentHistoryEntry[] = [];

  record(entry: AssessmentHistoryEntry) {
    this.entries.push(entry);
  }

  getHistoryForAssessment(assessmentId: string): AssessmentHistoryEntry[] {
    return this.entries.filter(e => e.assessmentId === assessmentId);
  }

  getAll(): AssessmentHistoryEntry[] {
    return [...this.entries];
  }
}
