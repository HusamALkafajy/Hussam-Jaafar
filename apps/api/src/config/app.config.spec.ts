import appConfig from './app.config';
import { DEFAULT_THROTTLE_LIMIT, DEFAULT_THROTTLE_TTL_MS } from './env.validation';

const keys = ['THROTTLE_LIMIT', 'THROTTLE_TTL', 'APP_HOST'] as const;
type ThrottleKey = (typeof keys)[number];

describe('app configuration throttling', () => {
  let snapshot: Record<ThrottleKey, string | undefined>;

  beforeEach(() => {
    snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]])) as Record<ThrottleKey, string | undefined>;
    delete process.env.THROTTLE_LIMIT;
    delete process.env.THROTTLE_TTL;
    delete process.env.APP_HOST;
  });

  afterEach(() => {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  });

  it('uses documented defaults only when throttle variables are absent', () => {
    expect(appConfig()).toMatchObject({
      throttleLimit: DEFAULT_THROTTLE_LIMIT,
      throttleTtl: DEFAULT_THROTTLE_TTL_MS,
    });
  });

  it('exposes valid overrides through the registered app configuration', () => {
    process.env.THROTTLE_LIMIT = '17';
    process.env.THROTTLE_TTL = '45000';

    expect(appConfig()).toMatchObject({ throttleLimit: 17, throttleTtl: 45000 });
  });

  it('leaves the listen host undefined when APP_HOST is absent', () => {
    expect(appConfig().host).toBeUndefined();
  });

  it('exposes and trims an explicitly configured listen host', () => {
    process.env.APP_HOST = ' 127.0.0.1 ';
    expect(appConfig().host).toBe('127.0.0.1');
  });
});
