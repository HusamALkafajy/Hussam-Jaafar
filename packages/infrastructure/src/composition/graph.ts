import { IDependencyGraph, IModuleDescriptor, IProviderDescriptor } from './contracts';

export class DependencyGraph implements IDependencyGraph {
  validate(modules: IModuleDescriptor[]): void {
    const allRegistrations = new Map<string, boolean>();

    for (const mod of modules) {
      for (const reg of mod.registrations) {
        if (allRegistrations.has(reg.identifier)) {
          throw new Error(`DependencyValidation: Duplicate registration for identifier: ${reg.identifier}`);
        }
        allRegistrations.set(reg.identifier, true);
      }
    }

    const resolved = new Set<string>();
    const seen = new Set<string>();

    const resolveDependency = (identifier: string, stack: string[]) => {
      if (resolved.has(identifier)) return;
      if (seen.has(identifier)) {
        throw new Error(`DependencyValidation: Circular dependency detected: ${stack.join(' -> ')} -> ${identifier}`);
      }

      seen.add(identifier);
      stack.push(identifier);

      let found = false;
      for (const mod of modules) {
        for (const reg of mod.registrations) {
          if (reg.identifier === identifier) {
            found = true;
            for (const dep of reg.provider.dependencies) {
              resolveDependency(dep, [...stack]);
            }
          }
        }
      }

      // If a dependency is missing, we fail fast unless it's assumed to be provided externally (e.g. PrismaService in Nest, though we should register everything).
      // To strictly validate missing services, we will throw.
      if (!found) {
         throw new Error(`DependencyValidation: Missing registration for identifier: ${identifier} required by ${stack[stack.length - 2] || 'Root'}`);
      }

      seen.delete(identifier);
      resolved.add(identifier);
      stack.pop();
    };

    for (const mod of modules) {
      for (const reg of mod.registrations) {
        resolveDependency(reg.identifier, []);
      }
    }
  }

  getResolutionOrder(modules: IModuleDescriptor[]): IProviderDescriptor[] {
    this.validate(modules);
    
    // Simplistic return of all providers. NestJS resolves topological sort dynamically at runtime.
    const providers: IProviderDescriptor[] = [];
    for (const mod of modules) {
      for (const reg of mod.registrations) {
        providers.push(reg.provider);
      }
    }
    return providers;
  }
}
