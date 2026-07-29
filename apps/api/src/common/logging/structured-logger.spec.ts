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
    const redactionSentinel = `redaction-${Date.now()}-${Math.random()}`;

    logger.error({
      event: 'auth.failure',
      password: redactionSentinel,
      nested: {
        accessToken: redactionSentinel,
        refresh_token: redactionSentinel,
        authorization: `Bearer ${redactionSentinel}`,
        cookie: `session=${redactionSentinel}`,
        apiKey: redactionSentinel,
      },
    });

    const serialized = output.mock.calls[0][0] as string;
    expect(serialized).not.toContain(redactionSentinel);
    expect(JSON.parse(serialized).message.nested.cookie).toBe('[REDACTED]');
  });

  it('redacts token-like values embedded in strings', () => {
    const redactionSentinel = `token.${Date.now()}.${Math.random()}`;
    expect(
      redactLogValue(`authorization=Bearer ${redactionSentinel} password=${redactionSentinel}`),
    ).toBe('authorization=[REDACTED] password=[REDACTED]');
  });
});
