import { AuthorizationEngine } from './authorization/authorization-engine';
import { AuditEngine } from './audit/audit-engine';
import { ComplianceEngine } from './compliance/compliance-engine';
import { IdentityContext } from './core/identity-context';
import { ResourceAction } from './core/resource-action';
import { SecurityDecision } from './authorization/security-decision';

export class SecurityGateway {
  constructor(
    private authorizationEngine: AuthorizationEngine,
    private auditEngine: AuditEngine,
    public readonly complianceEngine: ComplianceEngine
  ) {}

  /**
   * The entry point for the application to request authorization.
   */
  authorize(
    identity: IdentityContext,
    resourceAction: ResourceAction,
    targetResourceMetadata?: Record<string, any>
  ): SecurityDecision {
    const decision = this.authorizationEngine.authorize(identity, resourceAction, targetResourceMetadata);

    // Audit every authorization attempt
    this.auditEngine.log({
      actor: identity,
      resourceAction,
      result: decision.result,
      metadata: {
        reason: decision.reason,
        evaluatedPolicies: decision.evaluatedPolicies
      }
    });

    return decision;
  }

  getRecentAudits() {
    return this.auditEngine.getRecent();
  }
}
