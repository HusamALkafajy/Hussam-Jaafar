export type Lifetime = 'Singleton' | 'Scoped' | 'Transient';

export interface ILifetimeDescriptor {
  readonly lifetime: Lifetime;
}

export interface IProviderDescriptor {
  readonly identifier: string;
  readonly lifetime: ILifetimeDescriptor;
  readonly dependencies: string[];
  readonly factory?: (...args: any[]) => any;
  readonly useClass?: any;
  readonly useValue?: any;
}

export interface IServiceRegistration {
  readonly identifier: string;
  readonly capabilities: string[];
  readonly version: string;
  readonly provider: IProviderDescriptor;
}

export interface IModuleDescriptor {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  readonly registrations: IServiceRegistration[];
}

export interface IDependencyGraph {
  validate(modules: IModuleDescriptor[]): void;
  getResolutionOrder(modules: IModuleDescriptor[]): IProviderDescriptor[];
}

export interface IModuleRegistrar {
  registerModule(): IModuleDescriptor;
}
