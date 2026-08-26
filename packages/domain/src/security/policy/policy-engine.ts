import { SecurityPolicy, PolicyContext } from './security-policies';
import { SecurityDecision } from '../authorization/security-decision';

export class PolicyEngine {
  private policies: SecurityPolicy[] = [];

  register(policy: SecurityPolicy) {
    this.policies.push(policy);
  }

  evaluate(context: PolicyContext): SecurityDecision {
    const evaluatedPolicies: string[] = [];

    for (const policy of this.policies) {
      const decision = policy.evaluate(context);
      
      if (decision !== 'NotApplicable') {
        evaluatedPolicies.push(policy.id);
        
        // Deny overrides Permit (fail-safe default)
        if (decision.result === 'Deny') {
          return {
            result: 'Deny',
            reason: decision.reason,
            evaluatedPolicies
          };
        }
      }
    }

    return {
      result: 'Permit',
      reason: 'All applicable policies passed',
      evaluatedPolicies
    };
  }
}
