import { 
  IConfigurationProvider, 
  IConfigurationSnapshot, 
  ISecretProvider, 
  IFeatureFlagProvider, 
  IEnvironmentProvider 
} from './contracts';
import { ApplicationConfiguration } from './schema';
import { ConfigurationPlatform, EnvSecretProvider, DefaultEnvironmentProvider } from './providers/env.provider';
import { FeatureFlagPlatform } from './feature-flags';

export class AppConfigurationProvider implements IConfigurationProvider<ApplicationConfiguration> {
  private _snapshot: IConfigurationSnapshot<ApplicationConfiguration>;
  private _secrets: ISecretProvider;
  private _features: IFeatureFlagProvider;
  private _env: IEnvironmentProvider;

  constructor() {
    // Fail fast on startup if config is invalid
    this._snapshot = ConfigurationPlatform.load();
    this._secrets = new EnvSecretProvider();
    this._features = new FeatureFlagPlatform();
    this._env = new DefaultEnvironmentProvider(this._snapshot.get.environment);
  }

  get snapshot(): IConfigurationSnapshot<ApplicationConfiguration> {
    return this._snapshot;
  }

  get secrets(): ISecretProvider {
    return this._secrets;
  }

  get features(): IFeatureFlagProvider {
    return this._features;
  }

  get env(): IEnvironmentProvider {
    return this._env;
  }
}
