import { IConfigurationSection } from './contracts';

export interface DatabaseConfig extends IConfigurationSection {
  url: string;
}

export interface StorageConfig extends IConfigurationSection {
  provider: 'local' | 's3' | 'memory';
  bucket: string;
  basePath?: string;
}

export interface QueueConfig extends IConfigurationSection {
  provider: 'bullmq' | 'memory';
  redisUrl?: string;
}

export interface ObservabilityConfig extends IConfigurationSection {
  loggerProvider: 'console' | 'pino';
  metricsProvider: 'memory' | 'datadog';
  tracingEnabled: boolean;
}

export interface SecurityConfig extends IConfigurationSection {
  jwtSecret: string;
  jwtExpiresIn: string;
}

export interface AIProviderConfig extends IConfigurationSection {
  provider: 'openai' | 'anthropic' | 'gemini';
  apiKey: string;
  model: string;
}

export interface ApplicationConfiguration {
  environment: string;
  database: DatabaseConfig;
  storage: StorageConfig;
  queue: QueueConfig;
  observability: ObservabilityConfig;
  security: SecurityConfig;
  ai: AIProviderConfig;
}

export class ConfigurationSchemaValidator {
  validate(config: any): asserts config is ApplicationConfiguration {
    if (!config) throw new Error('Configuration is missing');
    
    // Database
    if (!config.database?.url) throw new Error('Missing database.url');
    
    // Storage
    if (!config.storage?.provider) throw new Error('Missing storage.provider');
    if (!['local', 's3', 'memory'].includes(config.storage.provider)) throw new Error('Invalid storage.provider');
    if (!config.storage.bucket) throw new Error('Missing storage.bucket');

    // Queue
    if (!config.queue?.provider) throw new Error('Missing queue.provider');
    if (!['bullmq', 'memory'].includes(config.queue.provider)) throw new Error('Invalid queue.provider');
    
    // Observability
    if (!config.observability?.loggerProvider) throw new Error('Missing observability.loggerProvider');
    if (!config.observability?.metricsProvider) throw new Error('Missing observability.metricsProvider');
    if (typeof config.observability.tracingEnabled !== 'boolean') throw new Error('Missing observability.tracingEnabled');

    // Security
    if (!config.security?.jwtSecret) throw new Error('Missing security.jwtSecret');
    if (!config.security?.jwtExpiresIn) throw new Error('Missing security.jwtExpiresIn');

    // AI
    if (!config.ai?.provider) throw new Error('Missing ai.provider');
    if (!config.ai?.apiKey) throw new Error('Missing ai.apiKey');
    if (!config.ai?.model) throw new Error('Missing ai.model');
  }
}
