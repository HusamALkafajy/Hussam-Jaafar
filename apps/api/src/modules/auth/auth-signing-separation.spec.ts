import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('@studyai/database', () => ({ db: { transaction: jest.fn() } }));
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('inert-salt'),
  hash: jest.fn().mockResolvedValue('inert-hash'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService real JWT signing paths (persistence mocked)', () => {
  const access = randomBytes(48).toString('hex');
  const refresh = randomBytes(48).toString('hex');
  const user = { id: 'test-id', email: 'test@example.test', firstName: 'Test', lastName: 'User',
    role: 'student', refreshTokenHash: 'inert-hash' };
  const jwt = new JwtService();
  const users = { updateRefreshTokenHash: jest.fn(), rotateRefreshTokenHash: jest.fn().mockResolvedValue(true), findById: jest.fn().mockResolvedValue(user) };
  function service(refreshValue: string | undefined = refresh) {
    const values: Record<string, string | undefined> = {
      NODE_ENV: 'production', 'auth.jwtSecret': access, 'auth.jwtRefreshSecret': refreshValue,
      'auth.jwtAccessExpiration': '1m', 'auth.jwtRefreshExpiration': '2m',
    };
    const config = {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        if (!values[key]) throw new Error('Missing signing configuration');
        return values[key];
      },
    };
    return new AuthService(users as unknown as UsersService, jwt, config as unknown as ConfigService);
  }

  it('signs access only under access key and refresh only under refresh key', async () => {
    const result = await service().login(user);
    expect((await jwt.verifyAsync(result.accessToken, { secret: access })).sub).toBe(user.id);
    expect((await jwt.verifyAsync(result.refreshToken, { secret: refresh })).sub).toBe(user.id);
    await expect(jwt.verifyAsync(result.accessToken, { secret: refresh })).rejects.toThrow();
    await expect(jwt.verifyAsync(result.refreshToken, { secret: access })).rejects.toThrow();
  });
  it('rejects an access token at the refresh endpoint', async () => {
    const instance = service();
    const tokens = await instance.login(user);
    await expect(instance.refresh(tokens.accessToken)).rejects.toThrow('Invalid refresh token');
  });
  it('accepts a refresh token with mocked session persistence', async () => {
    const instance = service();
    const tokens = await instance.login(user);
    expect((await instance.refresh(tokens.refreshToken)).user.id).toBe(user.id);
  });
  it('fails closed before signing if refresh configuration is absent', async () => {
    await expect(service('').login(user)).rejects.toThrow('Missing signing configuration');
  });
  it('rejects shared production keys', async () => {
    await expect(service(access).login(user)).rejects.toThrow();
  });
});
