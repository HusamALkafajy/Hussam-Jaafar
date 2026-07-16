import { IModuleDescriptor, IServiceRegistration, IProviderDescriptor, Lifetime } from './contracts';

export class ModuleBuilder {
  private registrations: IServiceRegistration[] = [];

  constructor(
    private readonly name: string,
    private readonly version: string = '1.0.0',
    private readonly dependencies: string[] = []
  ) {}

  register(
    identifier: string,
    provider: Partial<IProviderDescriptor> & { useClass?: any; useValue?: any; factory?: any },
    lifetime: Lifetime = 'Singleton',
    capabilities: string[] = []
  ): this {
    const providerDescriptor: IProviderDescriptor = {
      identifier,
      lifetime: { lifetime },
      dependencies: provider.dependencies || [],
      useClass: provider.useClass,
      useValue: provider.useValue,
      factory: provider.factory,
    };

    this.registrations.push({
      identifier,
      capabilities,
      version: '1.0.0',
      provider: providerDescriptor
    });

    return this;
  }

  build(): IModuleDescriptor {
    return {
      name: this.name,
      version: this.version,
      dependencies: this.dependencies,
      registrations: this.registrations
    };
  }
}
