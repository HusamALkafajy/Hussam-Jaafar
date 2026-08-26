export interface IdentityContext {
  readonly id: string;
  readonly roles: string[];
  readonly claims: Record<string, any>;
  readonly permissions: string[]; // Explicitly assigned permissions outside of roles
  readonly tenantId?: string;
  readonly organizationId?: string;
  readonly metadata: Record<string, string>;
}
