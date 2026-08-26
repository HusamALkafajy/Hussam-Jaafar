export interface IConfigurationSection {
  [key: string]: any;
}

export interface IConfigurationSnapshot<T> {
  readonly get: T;
}

export interface IConfigurationSource {
  load(): Record<string, any>;
}

export interface IConfigurationValidator {
  validate(config: any): void; // Throws on error
}

export interface ISecretProvider {
  getSecret(key: string): string | undefined;
}

export interface IEnvironmentProvider {
  getEnvironment(): string;
  isProduction(): boolean;
  isDevelopment(): boolean;
  isTest(): boolean;
}

export interface IFeatureFlagProvider {
  isEnabled(flag: string, context?: Record<string, any>): boolean;
}

export interface IConfigurationProvider<T> {
  get snapshot(): IConfigurationSnapshot<T>;
  get secrets(): ISecretProvider;
  get features(): IFeatureFlagProvider;
  get env(): IEnvironmentProvider;
}
