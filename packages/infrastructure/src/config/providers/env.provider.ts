import { IConfigurationSource, ISecretProvider, IEnvironmentProvider } from '../contracts';
import { ApplicationConfiguration, ConfigurationSchemaValidator } from '../schema';
import { ConfigurationSnapshot } from '../snapshot';

export class EnvironmentSource implements IConfigurationSource {
  load(): Record<string, any> {
    return {
      environment: process.env.NODE_ENV || 'development',
      database: {
        url: process.env.DATABASE_URL,
      },
      storage: {
        provider: process.env.STORAGE_PROVIDER || 'local',
        bucket: process.env.STORAGE_BUCKET || 'studyai-assets',
        basePath: process.env.STORAGE_PATH || './.storage',
      },
      queue: {
        provider: process.env.QUEUE_PROVIDER || 'memory',
        redisUrl: process.env.REDIS_URL,
      },
      observability: {
        loggerProvider: process.env.LOGGER_PROVIDER || 'console',
        metricsProvider: process.env.METRICS_PROVIDER || 'memory',
        tracingEnabled: process.env.TRACING_ENABLED === 'true',
      },
      security: {
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
      },
      ai: {
        provider: process.env.AI_PROVIDER || 'openai',
        apiKey:
          process.env.AI_API_KEY ||
          process.env.OPENROUTER_API_KEY ||
          process.env.GEMINI_API_KEY,
        model: process.env.AI_MODEL || 'gpt-4o',
      },
    };
  }
}

export class EnvSecretProvider implements ISecretProvider {
  getSecret(key: string): string | undefined {
    // Only fetch exactly what is asked for, directly from env.
    return process.env[key];
  }
}

export class DefaultEnvironmentProvider implements IEnvironmentProvider {
  constructor(private readonly envName: string) {}

  getEnvironment(): string {
    return this.envName;
  }

  isProduction(): boolean {
    return this.envName === 'production';
  }

  isDevelopment(): boolean {
    return this.envName === 'development';
  }

  isTest(): boolean {
    return this.envName === 'test';
  }
}

export class ConfigurationPlatform {
  static load(): ConfigurationSnapshot {
    const source = new EnvironmentSource();
    const rawConfig = source.load();

    const validator: ConfigurationSchemaValidator = new ConfigurationSchemaValidator();
    validator.validate(rawConfig);

    return new ConfigurationSnapshot(rawConfig as ApplicationConfiguration);
  }
}
