import { StructuredLogger } from '../common/logging/structured-logger';
import aiConfig from './ai.config';
import { MAX_THROTTLE_TTL_MS, validate } from './env.validation';

const REQUIRED_BASE = {
  JWT_SECRET: Array(33).join('a'),
  JWT_REFRESH_SECRET: Array(33).join('b'),
  DATABASE_URL: String('postgresql://localhost/studyai'),
};

describe('environment validation', () => {
  const originalProviderEnvironment = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };

  afterEach(() => {
    jest.restoreAllMocks();
    for (const [name, value] of Object.entries(originalProviderEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('accepts production startup with explicit infrastructure and optional OAuth disabled', () => {
    expect(
      validate({
        ...REQUIRED_BASE,
        NODE_ENV: 'production',
        REDIS_URL: String('redis://localhost:6379'),
        FRONTEND_URL: 'https://alpha.example.test',
        STORAGE_PATH: '/app/apps/api/uploads',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      STORAGE_PATH: '/app/apps/api/uploads',
    });
  });

  it('accepts the staging host, port, and password Redis contract', () => {
    expect(
      validate({
        ...REQUIRED_BASE,
        NODE_ENV: 'production',
        REDIS_HOST: 'studyai-redis',
        REDIS_PORT: '6379',
        REDIS_PASSWORD: ['injected', 'at', 'runtime'].join('-'),
        FRONTEND_URL: 'https://alpha.example.test',
        STORAGE_PATH: '/app/apps/api/uploads',
      }),
    ).toMatchObject({
      REDIS_HOST: 'studyai-redis',
      REDIS_PORT: 6379,
    });
  });

  it('fails closed when production infrastructure settings are absent', () => {
    expect(() => validate({ ...REQUIRED_BASE, NODE_ENV: 'production' })).toThrow(
      'Production Redis requires REDIS_URL or REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD.',
    );
  });

  it('rejects a partial production Redis host contract', () => {
    expect(() =>
      validate({
        ...REQUIRED_BASE,
        NODE_ENV: 'production',
        REDIS_HOST: 'studyai-redis',
        REDIS_PORT: '6379',
        FRONTEND_URL: 'https://alpha.example.test',
        STORAGE_PATH: '/app/apps/api/uploads',
      }),
    ).toThrow(
      'Production Redis requires REDIS_URL or REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD.',
    );
  });

  it('rejects a partial Google OAuth configuration', () => {
    expect(() => validate({ ...REQUIRED_BASE, GOOGLE_CLIENT_ID: 'configured-client' })).toThrow(
      'Google OAuth requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    );
  });

  it('rejects a partial Apple OAuth configuration', () => {
    expect(() => validate({ ...REQUIRED_BASE, APPLE_CLIENT_ID: 'configured-client' })).toThrow(
      'Apple OAuth requires its complete credential set when enabled.',
    );
  });

  it('preserves JWT signing-secret length validation', () => {
    expect(() => validate({ ...REQUIRED_BASE, JWT_SECRET: 'too-short' })).toThrow(
      'JWT_SECRET must be at least 32 characters long',
    );
  });

  it('accepts validated throttle overrides without changing other validation', () => {
    expect(
      validate({ ...REQUIRED_BASE, THROTTLE_LIMIT: '17', THROTTLE_TTL: '45000' }),
    ).toMatchObject({ THROTTLE_LIMIT: 17, THROTTLE_TTL: 45000 });
  });

  it.each([
    ['zero', '0'], ['negative', '-1'], ['fractional', '1.5'], ['empty', ''],
    ['nonnumeric', 'fast'], ['partially numeric', '100requests'],
    ['surrounded by whitespace', ' 100'], ['unsafe integer', '9007199254740992'],
  ])('rejects a %s throttle limit', (_case, value) => {
    expect(() => validate({ ...REQUIRED_BASE, THROTTLE_LIMIT: value })).toThrow('THROTTLE_LIMIT');
  });

  it.each([
    ['zero', '0'], ['negative', '-1'], ['fractional', '60000.5'], ['empty', ''],
    ['nonnumeric', 'minute'], ['partially numeric', '60000ms'],
    ['surrounded by whitespace', '60000 '], ['timer overflow', String(MAX_THROTTLE_TTL_MS + 1)],
  ])('rejects a %s throttle TTL', (_case, value) => {
    expect(() => validate({ ...REQUIRED_BASE, THROTTLE_TTL: value })).toThrow('THROTTLE_TTL');
  });

  it('rejects an invalid throttle value even when the companion value is valid', () => {
    expect(() => validate({ ...REQUIRED_BASE, THROTTLE_LIMIT: '25', THROTTLE_TTL: '0' }))
      .toThrow('THROTTLE_TTL');
  });

  it('accepts Gemini as the only configured AI provider', () => {
    const geminiCredential = ['gemini', 'provider', 'canary'].join('-');

    expect(validate({ ...REQUIRED_BASE, GEMINI_API_KEY: geminiCredential })).toMatchObject({
      GEMINI_API_KEY: geminiCredential,
    });
  });

  it('accepts OpenRouter as the only configured AI provider', () => {
    expect(
      validate({ ...REQUIRED_BASE, OPENROUTER_API_KEY: 'openrouter-provider-canary' }),
    ).toMatchObject({ OPENROUTER_API_KEY: 'openrouter-provider-canary' });
  });

  it('preserves intentional mock-mode startup when neither supported provider is configured', () => {
    const warning = jest.spyOn(StructuredLogger.prototype, 'warn').mockImplementation();

    validate({ ...REQUIRED_BASE });

    expect(warning).toHaveBeenCalledWith(
      'Optional configuration is incomplete',
      expect.objectContaining({
        warnings: expect.arrayContaining([
          expect.stringContaining('GEMINI_API_KEY or OPENROUTER_API_KEY'),
        ]),
      }),
    );
  });

  it.each([
    ['GEMINI_API_KEY', ''],
    ['GEMINI_API_KEY', '   '],
    ['OPENROUTER_API_KEY', ''],
    ['OPENROUTER_API_KEY', '\t\r\n'],
  ])('rejects an empty configured %s value', (name, value) => {
    expect(() => validate({ ...REQUIRED_BASE, [name]: value })).toThrow(
      `${name} must be a non-empty string when configured.`,
    );
  });

  it('does not treat OPENAI_API_KEY as an OpenRouter credential', () => {
    const warning = jest.spyOn(StructuredLogger.prototype, 'warn').mockImplementation();

    validate({ ...REQUIRED_BASE, OPENAI_API_KEY: 'irrelevant-provider-canary' });

    expect(warning).toHaveBeenCalledWith(
      'Optional configuration is incomplete',
      expect.objectContaining({
        warnings: expect.arrayContaining([
          expect.stringContaining('GEMINI_API_KEY or OPENROUTER_API_KEY'),
        ]),
      }),
    );
  });

  it('preserves deterministic OpenRouter precedence when both supported providers exist', () => {
    const openRouterCredential = 'openrouter-precedence-canary';
    const geminiCredential = 'gemini-precedence-canary';
    validate({
      ...REQUIRED_BASE,
      OPENROUTER_API_KEY: openRouterCredential,
      GEMINI_API_KEY: geminiCredential,
    });
    process.env.OPENROUTER_API_KEY = openRouterCredential;
    process.env.GEMINI_API_KEY = geminiCredential;

    expect(aiConfig()).toEqual(
      expect.objectContaining({
        apiKey: openRouterCredential,
        openRouterApiKey: openRouterCredential,
        geminiApiKey: geminiCredential,
        baseUrl: 'https://openrouter.ai/api/v1',
        useGeminiSdk: false,
      }),
    );
  });
});
