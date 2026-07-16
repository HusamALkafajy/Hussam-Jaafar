export type Decision = 'Permit' | 'Deny';

export interface SecurityDecision {
  readonly result: Decision;
  readonly reason: string;
  readonly evaluatedPolicies: string[];
}
