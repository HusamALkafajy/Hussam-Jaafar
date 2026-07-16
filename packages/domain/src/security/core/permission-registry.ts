import { PermissionString, ResourceAction } from './resource-action';

export interface PermissionDefinition {
  readonly id: PermissionString;
  readonly description: string;
  readonly category: string;
}

export class PermissionRegistry {
  private permissions = new Map<PermissionString, PermissionDefinition>();

  register(def: PermissionDefinition) {
    if (this.permissions.has(def.id)) {
      throw new Error(`Permission ${def.id} is already registered.`);
    }
    this.permissions.set(def.id, def);
  }

  get(id: PermissionString): PermissionDefinition | undefined {
    return this.permissions.get(id);
  }

  getAll(): PermissionDefinition[] {
    return Array.from(this.permissions.values());
  }
}
