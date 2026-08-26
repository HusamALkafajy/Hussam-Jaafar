import { SecurityDecision } from './authorization/security-decision';
import { AuditRecord } from './audit/audit-engine';
import { IdentityContext } from './core/identity-context';

export interface SecurityContextViewModel {
  readonly identityId: string;
  readonly activeRoles: string[];
  readonly permissions: string[];
}

export interface AuditRecordViewModel {
  readonly id: string;
  readonly timestamp: string;
  readonly actorId: string;
  readonly action: string;
  readonly resource: string;
  readonly result: string;
}

export interface ComplianceStatusViewModel {
  readonly flagsActive: number;
  readonly rulesActive: number;
}
