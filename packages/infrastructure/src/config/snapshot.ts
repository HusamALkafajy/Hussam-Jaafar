import { IConfigurationSnapshot } from './contracts';
import { ApplicationConfiguration } from './schema';

export class ConfigurationSnapshot implements IConfigurationSnapshot<ApplicationConfiguration> {
  public readonly get: ApplicationConfiguration;

  constructor(config: ApplicationConfiguration) {
    // Deep freeze the configuration object to prevent runtime mutations
    this.get = this.deepFreeze(config);
  }

  private deepFreeze<T>(object: T): T {
    if (object && typeof object === 'object') {
      Object.freeze(object);
      Object.getOwnPropertyNames(object).forEach((prop) => {
        const propValue = (object as any)[prop];
        if (
          propValue !== null &&
          (typeof propValue === 'object' || typeof propValue === 'function') &&
          !Object.isFrozen(propValue)
        ) {
          this.deepFreeze(propValue);
        }
      });
    }
    return object;
  }
}
