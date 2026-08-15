import { MAX_THROTTLE_TTL_MS, validate } from './env.validation';

const REQUIRED_BASE = {
  JWT_SECRET: Array(33).join('a'),
  JWT_REFRESH_SECRET: Array(33).join('b'),
  DATABASE_URL: String('postgresql://localhost/studyai'),
};

describe('environment validation', () => {
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
});
