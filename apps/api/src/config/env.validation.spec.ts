import { validate } from './env.validation';

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

  it('fails closed when production infrastructure settings are absent', () => {
    expect(() => validate({ ...REQUIRED_BASE, NODE_ENV: 'production' })).toThrow(
      'REDIS_URL is required in production.',
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
});
