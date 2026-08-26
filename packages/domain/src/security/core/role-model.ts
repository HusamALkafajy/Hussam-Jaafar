import { PermissionString } from './resource-action';

export interface RoleDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly isSystem: boolean;
  readonly permissions: PermissionString[];
}

export class RoleRegistry {
  private roles = new Map<string, RoleDefinition>();

  register(def: RoleDefinition) {
    if (this.roles.has(def.id)) {
      throw new Error(`Role ${def.id} is already registered.`);
    }
    this.roles.set(def.id, def);
  }

  get(id: string): RoleDefinition | undefined {
    return this.roles.get(id);
  }

  getAll(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }
}
