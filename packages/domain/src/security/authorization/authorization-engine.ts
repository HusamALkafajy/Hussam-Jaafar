import { PolicyEngine } from '../policy/policy-engine';
import { IdentityContext } from '../core/identity-context';
import { ResourceAction, PermissionString } from '../core/resource-action';
import { RoleRegistry } from '../core/role-model';
import { SecurityDecision } from './security-decision';

export class AuthorizationEngine {
  constructor(
    private policyEngine: PolicyEngine,
    private roleRegistry: RoleRegistry
  ) {}

  /**
   * Evaluates identity and requested action to yield an immutable SecurityDecision.
   * This is the centralized Policy Decision Point (PDP).
   */
  authorize(
    identity: IdentityContext,
    resourceAction: ResourceAction,
    targetResourceMetadata?: Record<string, any>
  ): SecurityDecision {
    // 1. Check direct permissions
    const requiredPermission: PermissionString = `${resourceAction.resource.toLowerCase()}.${resourceAction.action.toLowerCase()}` as PermissionString;
    
    let hasPermission = identity.permissions.includes(requiredPermission);

    // 2. Check inherited permissions via roles
    if (!hasPermission) {
      for (const roleId of identity.roles) {
        const roleDef = this.roleRegistry.get(roleId);
        if (roleDef && roleDef.permissions.includes(requiredPermission)) {
          hasPermission = true;
          break;
        }
      }
    }

    if (!hasPermission) {
      return {
        result: 'Deny',
        reason: `Identity lacks required permission: ${requiredPermission}`,
        evaluatedPolicies: []
      };
    }

    // 3. Evaluate context against policies
    const policyContext = {
      identity,
      resourceAction,
      targetResourceMetadata
    };

    return this.policyEngine.evaluate(policyContext);
  }
}
