jest.mock('../../users/users.service', () => ({
  UsersService: class UsersService {},
}));

import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import type { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';
import { StructuredLogger } from '../../../common/logging/structured-logger';

describe('JwtStrategy logging', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('keeps authentication identifiers and lookup diagnostics redacted', async () => {
    const output = jest.spyOn(console, 'error').mockImplementation();
    const email = ['learner', '@example.com'].join('');
    const credentialSentinel = ['disposable', 'credential'].join('-');
    const credentialUrl = [
      'postgresql:',
      '//user:',
      credentialSentinel,
      '@localhost/studyai',
    ].join('');
    const lookupError = new Error(`Lookup failed for ${email} at ${credentialUrl}`);
    const usersService = {
      findById: jest.fn().mockRejectedValue(lookupError),
    } as unknown as UsersService;
    const config = {
      get: jest.fn().mockReturnValue('x'.repeat(40)),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(config, usersService);
    (
      strategy as unknown as {
        logger: StructuredLogger;
      }
    ).logger = new StructuredLogger(true, JwtStrategy.name);

    await expect(
      strategy.validate({
        sub: 'sensitive-user-id',
        email,
        role: 'STUDENT',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(output).toHaveBeenCalledTimes(1);
    const serialized = output.mock.calls[0][0] as string;
    const entry = JSON.parse(serialized);
    expect(entry).toEqual(
      expect.objectContaining({
        level: 'error',
        source: 'JwtStrategy',
        message: 'JWT user lookup failed',
      }),
    );
    expect(entry.context[0]).toEqual(
      expect.objectContaining({
        name: 'Error',
        message: 'Lookup failed for [REDACTED] at [REDACTED]',
        stack: expect.any(String),
      }),
    );
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain('sensitive-user-id');
    expect(serialized).not.toContain(credentialSentinel);
    expect(serialized).not.toContain('postgresql:');
  });
});
