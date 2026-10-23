import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { createHash } from 'node:crypto';

jest.mock('@studyai/database', () => ({ db: { transaction: jest.fn() } }));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

const bcrypt = require('bcrypt') as {
  compare: jest.Mock;
  genSalt: jest.Mock;
  hash: jest.Mock;
};

describe('AuthService refresh session contract', () => {
  const user = {
    id: 'user-1',
    email: 'student@example.test',
    firstName: 'Student',
    lastName: 'One',
    role: 'student',
    refreshTokenHash: 'hash-before-rotation',
  };

  let currentRefreshHash: string | null;
  let usersService: {
    findById: jest.Mock;
    updateRefreshTokenHash: jest.Mock;
    rotateRefreshTokenHash: jest.Mock;
  };
  let jwtService: {
    verifyAsync: jest.Mock;
    signAsync: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    currentRefreshHash = 'hash-before-rotation';
    usersService = {
      findById: jest.fn(async () => ({ ...user, refreshTokenHash: currentRefreshHash })),
      updateRefreshTokenHash: jest.fn(async (_userId: string, nextHash: string | null) => {
        currentRefreshHash = nextHash;
      }),
      rotateRefreshTokenHash: jest.fn(async (_id: string, expected: string, next: string) => {
        if (currentRefreshHash !== expected) return false;
        currentRefreshHash = next;
        return true;
      }),
    };
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: user.id }),
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-after-rotation')
        .mockResolvedValueOnce('refresh-after-rotation'),
    };
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'auth.jwtSecret': ['access', 'secret'].join('-'),
          'auth.jwtRefreshSecret': ['refresh', 'secret'].join('-'),
          'auth.jwtAccessExpiration': '15m',
          'auth.jwtRefreshExpiration': '7d',
        };
        return values[key];
      }),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'auth.jwtSecret': ['access', 'secret'].join('-'),
          'auth.jwtRefreshSecret': ['refresh', 'secret'].join('-'),
        };
        const value = values[key];
        if (!value) throw new Error(`Missing test configuration: ${key}`);
        return value;
      }),
    };
    service = new AuthService(usersService as any, jwtService as any, configService as any);
    jest.clearAllMocks();
    jwtService.verifyAsync.mockResolvedValue({ sub: user.id });
    jwtService.signAsync
      .mockResolvedValueOnce('access-after-rotation')
      .mockResolvedValueOnce('refresh-after-rotation');
    bcrypt.genSalt.mockResolvedValue('new-salt');
    bcrypt.hash.mockResolvedValue('hash-after-rotation');
    bcrypt.compare.mockImplementation(async (token: string, hash: string | null) =>
      token === createHash('sha256').update('refresh-before-rotation').digest('hex') && hash === 'hash-before-rotation',
    );
  });

  it('rotates a valid refresh session and rejects reuse of the revoked token', async () => {
    const result = await service.refresh('refresh-before-rotation');

    expect(result.refreshToken).toBe('refresh-after-rotation');
    expect(usersService.rotateRefreshTokenHash).toHaveBeenCalledWith(
      user.id,
      'hash-before-rotation',
      'hash-after-rotation',
    );
    expect(usersService.updateRefreshTokenHash).not.toHaveBeenCalled();

    await expect(service.refresh('refresh-before-rotation')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes the validated refresh session during logout', async () => {
    await service.logoutWithRefreshToken('refresh-before-rotation');

    expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(user.id, null);
  });

  it('keeps logout idempotent when the refresh cookie has already been revoked', async () => {
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      service.logoutWithRefreshToken('refresh-before-rotation'),
    ).resolves.toBeUndefined();
    expect(usersService.updateRefreshTokenHash).not.toHaveBeenCalled();
  });

  it('does not hide a persistence failure while revoking a valid session', async () => {
    usersService.updateRefreshTokenHash.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.logoutWithRefreshToken('refresh-before-rotation'),
    ).rejects.toThrow('database unavailable');
  });
});
