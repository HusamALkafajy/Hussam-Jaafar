import { randomBytes } from 'node:crypto';

describe('application throttler configuration', () => {
  const environmentKeys = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;
  const environmentSnapshot = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  ) as Record<(typeof environmentKeys)[number], string | undefined>;

  afterAll(() => {
    for (const key of environmentKeys) {
      if (environmentSnapshot[key] === undefined) delete process.env[key];
      else process.env[key] = environmentSnapshot[key];
    }
  });

  it('passes registered throttle values to Nest without hard-coded fallbacks', async () => {
    process.env.DATABASE_URL = String.raw`postgresql://localhost/studyai_test`;
    Object.assign(process.env, {
      JWT_SECRET: randomBytes(32).toString('hex'),
      JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    });
    const { createThrottlerOptions } = await import('./app.module');
    const values: Record<string, number> = {
      'app.throttleLimit': 17,
      'app.throttleTtl': 45000,
    };
    const configService = {
      getOrThrow: jest.fn((key: string) => values[key]),
    } as any;

    expect(createThrottlerOptions(configService)).toEqual({
      throttlers: [{ limit: 17, ttl: 45000 }],
      setHeaders: true,
    });
    expect(configService.getOrThrow).toHaveBeenNthCalledWith(1, 'app.throttleLimit');
    expect(configService.getOrThrow).toHaveBeenNthCalledWith(2, 'app.throttleTtl');
  });
});
