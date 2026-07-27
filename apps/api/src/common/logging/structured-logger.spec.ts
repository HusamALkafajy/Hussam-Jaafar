import { requestContext } from '../request-context';
import { redactLogValue, StructuredLogger } from './structured-logger';

describe('StructuredLogger', () => {
  afterEach(() => jest.restoreAllMocks());

  it('emits machine-readable production logs with request correlation', () => {
    const output = jest.spyOn(console, 'log').mockImplementation();
    const logger = new StructuredLogger(true);

    requestContext.run({ requestId: 'request-123' }, () => {
      logger.log({ event: 'request.complete', statusCode: 200 });
    });

    const entry = JSON.parse(output.mock.calls[0][0] as string);
    expect(entry).toEqual(
      expect.objectContaining({
        level: 'log',
        requestId: 'request-123',
        message: { event: 'request.complete', statusCode: 200 },
      }),
    );
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it('redacts sensitive fields recursively without logging a request body', () => {
    const output = jest.spyOn(console, 'error').mockImplementation();
    const logger = new StructuredLogger(true);

    logger.error({
      event: 'auth.failure',
      password: 'do-not-log',
      nested: {
        accessToken: 'access-secret',
        refresh_token: 'refresh-secret',
        authorization: 'Bearer header-secret',
        cookie: 'session=secret',
        apiKey: 'provider-secret',
      },
    });

    const serialized = output.mock.calls[0][0] as string;
    expect(serialized).not.toContain('do-not-log');
    expect(serialized).not.toContain('access-secret');
    expect(serialized).not.toContain('refresh-secret');
    expect(serialized).not.toContain('header-secret');
    expect(serialized).not.toContain('session=secret');
    expect(serialized).not.toContain('provider-secret');
    expect(JSON.parse(serialized).message.nested.cookie).toBe('[REDACTED]');
  });

  it('redacts token-like values embedded in strings', () => {
    expect(
      redactLogValue('authorization=Bearer abc.def.ghi password=unsafe'),
    ).toBe('authorization=[REDACTED] password=[REDACTED]');
  });
});
