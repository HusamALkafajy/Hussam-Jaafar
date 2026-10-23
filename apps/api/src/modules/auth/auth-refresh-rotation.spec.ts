import { createHash, randomBytes } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('@studyai/database', () => ({ db: { transaction: jest.fn() } }));

describe('Refresh rotation with real JWT signing and real bcrypt', () => {
  const user = { id: 'rotation-subject', email: 'rotation@example.test', firstName: 'Test',
    lastName: 'User', role: 'student' };
  const jwt = new JwtService();
  let currentHash: string | null;
  let service: AuthService;
  let users: { findById: jest.Mock; updateRefreshTokenHash: jest.Mock; rotateRefreshTokenHash: jest.Mock };
  const digest = (value: string) => createHash('sha256').update(value).digest('hex');

  beforeEach(() => {
    currentHash = null;
    const values: Record<string, string> = {
      NODE_ENV: 'production',
      'auth.jwtSecret': randomBytes(48).toString('hex'),
      'auth.jwtRefreshSecret': randomBytes(48).toString('hex'),
      'auth.jwtAccessExpiration': '15m', 'auth.jwtRefreshExpiration': '7d',
    };
    const config = { get: (key: string) => values[key], getOrThrow: (key: string) => values[key] };
    users = {
      findById: jest.fn(async () => ({ ...user, refreshTokenHash: currentHash })),
      updateRefreshTokenHash: jest.fn(async (_id: string, next: string | null) => { currentHash = next; }),
      rotateRefreshTokenHash: jest.fn(async (id: string, expected: string, next: string) => {
        if (id !== user.id || currentHash !== expected) return false;
        currentHash = next;
        return true;
      }),
    };
    service = new AuthService(users as unknown as UsersService, jwt, config as ConfigService);
    // Deterministic same-second test, not a production clock-delay workaround.
    jest.spyOn(Date, 'now').mockReturnValue(1780000000000);
  });
  afterEach(() => jest.restoreAllMocks());

  it('issues distinct refresh JWTs immediately with unique JTI; access claims/expiry stay unchanged', async () => {
    const first = await service.login({ ...user });
    const second = await service.login({ ...user });
    const a = jwt.decode(first.refreshToken), b = jwt.decode(second.refreshToken);
    expect(first.refreshToken !== second.refreshToken).toBe(true);
    expect(a.iat === b.iat).toBe(true);
    expect(a.jti !== b.jti).toBe(true);
    expect(/^[0-9a-f-]{36}$/.test(a.jti)).toBe(true);
    expect(Object.keys(a).sort()).toEqual(['email', 'exp', 'iat', 'jti', 'role', 'sub']);
    expect(a.exp - a.iat).toBe(7 * 24 * 3600);
    const access = jwt.decode(first.accessToken);
    expect(Object.keys(access).sort()).toEqual(['email', 'exp', 'iat', 'role', 'sub']);
    expect(access.exp - access.iat).toBe(900);
    expect('refreshTokenHash' in first).toBe(false);
  });

  it('binds the complete token beyond bcrypt\'s 72-byte prefix without storing raw JWTs', async () => {
    const first = await service.login({ ...user });
    const second = await service.login({ ...user });
    expect(Buffer.from(first.refreshToken).subarray(0, 72).equals(Buffer.from(second.refreshToken).subarray(0, 72))).toBe(true);
    expect(await bcrypt.compare(digest(second.refreshToken), currentHash!)).toBe(true);
    expect(await bcrypt.compare(digest(first.refreshToken), currentHash!)).toBe(false);
    expect(await bcrypt.compare(second.refreshToken, currentHash!)).toBe(false);
    expect(digest(second.refreshToken).length).toBe(64);
  });

  it('rejects sequential replay and lets the newly issued token rotate once', async () => {
    const first = await service.login({ ...user });
    const next = await service.refresh(first.refreshToken);
    expect(first.refreshToken !== next.refreshToken).toBe(true);
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    const final = await service.refresh(next.refreshToken);
    expect(final.user.id).toBe(user.id);
    expect(final.refreshToken !== next.refreshToken).toBe(true);
    await expect(service.refresh(next.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.updateRefreshTokenHash).toHaveBeenCalledTimes(1);
  });

  it('allows exactly one concurrent consumer after both read the identical old hash', async () => {
    const first = await service.login({ ...user });
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    users.findById.mockImplementation(async () => {
      const snapshot = { ...user, refreshTokenHash: currentHash };
      if (++arrivals === 2) release();
      await barrier;
      return snapshot;
    });
    const results = await Promise.allSettled([service.refresh(first.refreshToken), service.refresh(first.refreshToken)]);
    expect(arrivals).toBe(2);
    expect(results.filter(result => result.status === 'fulfilled').length).toBe(1);
    expect(results.filter(result => result.status === 'rejected' && result.reason instanceof UnauthorizedException).length).toBe(1);
    expect(users.rotateRefreshTokenHash).toHaveBeenCalledTimes(2);
    expect(users.rotateRefreshTokenHash.mock.calls[0][1] === users.rotateRefreshTokenHash.mock.calls[1][1]).toBe(true);
    users.findById.mockImplementation(async () => ({ ...user, refreshTokenHash: currentHash }));
    const winner = results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<AuthService['refresh']>>>;
    expect((await service.refresh(winner.value.refreshToken)).user.id).toBe(user.id);
  });

  it('fails closed if revocation occurs after validation but before rotation', async () => {
    const first = await service.login({ ...user });
    users.rotateRefreshTokenHash.mockImplementationOnce(async () => { currentHash = null; return false; });
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(currentHash === null).toBe(true);
    expect(users.updateRefreshTokenHash).toHaveBeenCalledTimes(1);
  });

  it('fails closed for legacy raw-bcrypt sessions rather than retaining the vulnerable comparison', async () => {
    const first = await service.login({ ...user });
    currentHash = await bcrypt.hash(first.refreshToken, 12);
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.rotateRefreshTokenHash).not.toHaveBeenCalled();
  });

  it('revokes digest-bound sessions on logout and preserves idempotent revoked-cookie handling', async () => {
    const first = await service.login({ ...user });
    await service.logoutWithRefreshToken(first.refreshToken);
    expect(currentHash === null).toBe(true);
    await expect(service.logoutWithRefreshToken(first.refreshToken)).resolves.toBeUndefined();
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
