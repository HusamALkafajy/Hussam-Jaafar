import {
  ConfigurationSchemaValidator,
  EnvironmentSource,
} from '@studyai/infrastructure';

describe('infrastructure configuration alignment', () => {
  const originalEnvironment = {
    AI_API_KEY: process.env.AI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('accepts the API mock-mode contract when no optional AI key is configured', () => {
    const validator = new ConfigurationSchemaValidator();

    expect(() =>
      validator.validate({
        environment: 'development',
        database: { url: 'postgresql://localhost/studyai' },
        storage: { provider: 'memory', bucket: 'test' },
        queue: { provider: 'memory' },
        observability: {
          loggerProvider: 'console',
          metricsProvider: 'memory',
          tracingEnabled: false,
        },
        security: { jwtSecret: 'test-secret', jwtExpiresIn: '1d' },
        ai: { provider: 'openai', model: 'test-model' },
      }),
    ).not.toThrow();
  });

  it('keeps mandatory infrastructure configuration fail-closed', () => {
    const validator = new ConfigurationSchemaValidator();

    expect(() =>
      validator.validate({
        environment: 'development',
        database: {},
        storage: { provider: 'memory', bucket: 'test' },
        queue: { provider: 'memory' },
        observability: {
          loggerProvider: 'console',
          metricsProvider: 'memory',
          tracingEnabled: false,
        },
        security: { jwtSecret: 'test-secret', jwtExpiresIn: '1d' },
        ai: { provider: 'openai', model: 'test-model' },
      }),
    ).toThrow('Missing database.url');
  });

  it('maps the API provider keys into the shared configuration snapshot', () => {
    const openRouterSentinel = ['openrouter', 'test', 'sentinel'].join('-');
    const geminiSentinel = ['gemini', 'test', 'sentinel'].join('-');

    delete process.env.AI_API_KEY;
    process.env.OPENROUTER_API_KEY = openRouterSentinel;
    process.env.GEMINI_API_KEY = geminiSentinel;

    const config = new EnvironmentSource().load();

    expect(config.ai.apiKey).toBe(openRouterSentinel);
  });
});
