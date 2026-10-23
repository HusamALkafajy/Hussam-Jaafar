import { ArgumentsHost, LoggerService } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter URL privacy', () => {
  it.each([undefined, '/auth/callback'])('never logs or returns raw request URL (%#)', (route) => {
    const marker = `private-${Date.now()}-${Math.random()}`;
    const logger = { error: jest.fn() };
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = { switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: `/reset/${marker}?code=${marker}`, route: { path: route } }),
    }) };
    new HttpExceptionFilter(logger as unknown as LoggerService)
      .catch(new Error('internal'), host as unknown as ArgumentsHost);
    expect(JSON.stringify(logger.error.mock.calls).includes(marker)).toBe(false);
    expect(JSON.stringify(response.json.mock.calls).includes(marker)).toBe(false);
    expect(response.json.mock.calls[0][0].path).toBe(route ?? '[unmatched-route]');
  });
});
