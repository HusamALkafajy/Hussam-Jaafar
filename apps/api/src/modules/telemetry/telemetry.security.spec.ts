import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Counter, Histogram } from 'prom-client';
import { TelemetryInterceptor } from './telemetry.interceptor';

describe('telemetry route privacy', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([false, true])('keeps URL/path/query and error payload out of logs/metrics (%#)', async (fails) => {
    const marker = `private-${Date.now()}-${Math.random()}`;
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const labels = jest.fn(() => ({ inc: jest.fn(), observe: jest.fn() }));
    const metric = { labels };
    const interceptor = new TelemetryInterceptor(metric as unknown as Counter<string>,
      metric as unknown as Histogram<string>, metric as unknown as Counter<string>);
    const context = { switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: `/reset/${marker}?code=${marker}`, route: { path: '/reset/:token' } }),
      getResponse: () => ({ statusCode: 200 }),
    }) } as unknown as ExecutionContext;
    const next = { handle: () => fails ? throwError(() => new Error(marker)) : of({ ok: true }) } as CallHandler;
    try { await firstValueFrom(interceptor.intercept(context, next)); } catch { /* original error propagates */ }
    expect(JSON.stringify([log.mock.calls, error.mock.calls, labels.mock.calls]).includes(marker)).toBe(false);
    expect(labels.mock.calls[0]).toEqual(['GET', '/reset/:token', fails ? '500' : '200']);
  });
});
