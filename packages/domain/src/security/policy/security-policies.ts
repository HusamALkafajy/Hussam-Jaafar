import { IdentityContext } from '../core/identity-context';
import { ResourceAction } from '../core/resource-action';
import { SecurityDecision } from '../authorization/security-decision';

export interface PolicyContext {
  identity: IdentityContext;
  resourceAction: ResourceAction;
  targetResourceMetadata?: Record<string, any>;
  environment?: Record<string, any>;
}

export interface SecurityPolicy {
  readonly id: string;
  evaluate(context: PolicyContext): SecurityDecision | 'NotApplicable';
}

// Example policies interfaces for extensibility
export interface AuthorizationPolicy extends SecurityPolicy {}
export interface OwnershipPolicy extends SecurityPolicy {}
export interface VisibilityPolicy extends SecurityPolicy {}
export interface SharingPolicy extends SecurityPolicy {}
export interface RetentionPolicy extends SecurityPolicy {}
export interface ExportPolicy extends SecurityPolicy {}
export interface RateLimitPolicy extends SecurityPolicy {}
