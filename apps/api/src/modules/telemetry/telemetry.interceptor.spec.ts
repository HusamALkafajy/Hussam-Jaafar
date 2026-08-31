import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { requestContext } from '../../common/request-context';
import { TelemetryInterceptor } from './telemetry.interceptor';

function metric() {
  return {
    labels: jest.fn().mockReturnValue({ inc: jest.fn(), observe: jest.fn() }),
  };
}

function httpContext(request: Record<string, unknown>, statusCode = 200): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode }),
    }),
  } as ExecutionContext;
}

describe('TelemetryInterceptor', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('emits a bounded correlated failure without serializing request or error data', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-23T00:00:00.000Z'));
    const output = jest.spyOn(console, 'error').mockImplementation();
    const interceptor = new TelemetryInterceptor(
      metric() as never,
      metric() as never,
      metric() as never,
      { get: () => 'production' } as never,
    );
    const dynamicId = '4f3bb174-c9ab-47e7-979c-7dc35bd4b89c';
    const oauthCode = 'oauth-code-canary';
    const oauthState = 'oauth-state-canary';
    const token = 'access-token-canary';
    const cookie = 'session-cookie-canary';
    const databaseStatement = 'select private_column from private_relation';
    const error = new Error(
      `${databaseStatement}; code=${oauthCode}; state=${oauthState}; token=${token}`,
    );
    const context = httpContext({
      method: 'POST',
      path: `/api/exams/${dynamicId}`,
      url: `/api/exams/${dynamicId}?code=${oauthCode}&state=${oauthState}`,
      headers: { authorization: `Bearer ${token}`, cookie },
      user: { id: 'user-identifier-canary' },
    });
    const next: CallHandler = { handle: () => throwError(() => error) };

    const operation = requestContext.run({ requestId: 'request-correlation-123' }, async () => {
      const promise = firstValueFrom(interceptor.intercept(context, next));
      jest.advanceTimersByTime(17);
      await expect(promise).rejects.toBe(error);
    });
    await operation;

    const serialized = output.mock.calls[0][0] as string;
    const entry = JSON.parse(serialized);
    expect(entry).toEqual(
      expect.objectContaining({
        level: 'error',
        source: 'Telemetry',
        requestId: 'request-correlation-123',
        message: {
          event: 'http.request.failed',
          reasonCode: 'request_failed',
          method: 'POST',
          route: '/api/exams/:id',
          statusCode: 500,
          durationMs: expect.any(Number),
          errorCategory: 'application_error',
        },
      }),
    );
    expect(entry.message.durationMs).toBeGreaterThanOrEqual(0);
    for (const canary of [
      dynamicId,
      oauthCode,
      oauthState,
      token,
      cookie,
      databaseStatement,
      'private_relation',
      'user-identifier-canary',
      '?code=',
    ]) {
      expect(serialized).not.toContain(canary);
    }
  });

  it('uses the framework route template and preserves successful metric behavior', async () => {
    const output = jest.spyOn(console, 'log').mockImplementation();
    const requests = metric();
    const durations = metric();
    const operations = metric();
    const interceptor = new TelemetryInterceptor(
      requests as never,
      durations as never,
      operations as never,
      { get: () => 'production' } as never,
    );
    const context = httpContext(
      {
        method: 'GET',
        baseUrl: '/api',
        path: '/files/917',
        route: { path: '/files/:fileId' },
        url: '/api/files/917?state=query-canary',
      },
      200,
    );

    await requestContext.run({ requestId: 'request-correlation-456' }, () =>
      firstValueFrom(interceptor.intercept(context, { handle: () => of({ ok: true }) })),
    );

    const entry = JSON.parse(output.mock.calls[0][0] as string);
    expect(entry).toEqual(
      expect.objectContaining({
        requestId: 'request-correlation-456',
        message: expect.objectContaining({
          event: 'http.request.completed',
          reasonCode: 'request_completed',
          method: 'GET',
          route: '/api/files/:fileId',
          statusCode: 200,
          durationMs: expect.any(Number),
        }),
      }),
    );
    expect(output.mock.calls[0][0]).not.toContain('query-canary');
    expect(requests.labels).toHaveBeenCalledWith('GET', '/api/files/:fileId', '200');
    expect(durations.labels).toHaveBeenCalledWith('GET', '/api/files/:fileId');
  });
});
