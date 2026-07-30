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

  it('preserves error diagnostics while redacting credential-bearing URLs', () => {
    const redactionSentinel = `credential-${Date.now()}-${Math.random()}`;
    const credentialUrl = ['postgresql:', '//user:', redactionSentinel, '@localhost/studyai'].join(
      '',
    );
    const error = new Error(`Database connection failed for ${credentialUrl}`);

    const sanitized = redactLogValue(error) as {
      name: string;
      message: string;
      stack: string;
    };

    expect(sanitized.name).toBe('Error');
    expect(sanitized.message).toContain('Database connection failed');
    expect(sanitized.stack).toContain('structured-logger.spec.ts');
    expect(JSON.stringify(sanitized)).not.toContain(redactionSentinel);
    expect(sanitized.message).toBe('Database connection failed for [REDACTED]');
    expect(JSON.stringify(sanitized)).not.toContain('postgresql:');
  });

  it('redacts credential-free database and cache URLs completely', () => {
    const value = ['database=', 'postgresql:', '//localhost/studyai ', 'cache=', 'redis:', '//localhost:6379'].join(
      '',
    );

    expect(redactLogValue(value)).toBe('database=[REDACTED] cache=[REDACTED]');
  });
});
