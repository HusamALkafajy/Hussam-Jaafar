import { IProviderDescriptor, Lifetime } from './contracts';

export class NestBridge {
  static generateProviders(descriptors: IProviderDescriptor[]): any[] {
    return descriptors.map(desc => this.createNestProvider(desc));
  }

  private static createNestProvider(desc: IProviderDescriptor): any {
    const provider: any = {
      provide: desc.identifier,
    };

    if (desc.useValue !== undefined) {
      provider.useValue = desc.useValue;
    } else if (desc.useClass !== undefined) {
      provider.useClass = desc.useClass;
    } else if (desc.factory !== undefined) {
      provider.useFactory = desc.factory;
      provider.inject = desc.dependencies;
    } else {
      throw new Error(`Invalid provider descriptor for ${desc.identifier}: must specify useValue, useClass, or factory.`);
    }

    return provider;
  }
}
