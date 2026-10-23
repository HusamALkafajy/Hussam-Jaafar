import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { createCsrfProtectionMiddleware } from '../../common/middleware/csrf-protection.middleware';

jest.mock('@studyai/database', () => ({ db: { transaction: jest.fn() } }));

describe('Refresh controller HTTP qualification (not functional acceptance)', () => {
  let app: INestApplication;
  let service: AuthService;
  let stored: string | null;
  let rotate: jest.Mock;
  const user = { id: 'http-rotation-subject', email: 'http@example.test', firstName: 'Test', lastName: 'User', role: 'student' };
  const origin = 'http://127.0.0.1:54321';
  const csrf = 'synthetic-csrf';
  beforeEach(async () => {
    stored = null;
    const values: Record<string, string> = { NODE_ENV: 'production',
      'auth.jwtSecret': randomBytes(48).toString('hex'), 'auth.jwtRefreshSecret': randomBytes(48).toString('hex'),
      'auth.jwtAccessExpiration': '15m', 'auth.jwtRefreshExpiration': '7d' };
    rotate = jest.fn(async (_id: string, expected: string, next: string) => {
      if (stored !== expected) return false;
      stored = next;
      return true;
    });
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [AuthService,
      { provide: JwtService, useValue: new JwtService() },
      { provide: ConfigService, useValue: { get: (key: string) => values[key], getOrThrow: (key: string) => values[key] } },
      { provide: UsersService, useValue: {
        findById: async () => ({ ...user, refreshTokenHash: stored }),
        updateRefreshTokenHash: async (_id: string, next: string | null) => { stored = next; },
        rotateRefreshTokenHash: rotate,
      } },
    ] }).compile();
    service = module.get(AuthService);
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.use(createCsrfProtectionMiddleware([origin]));
    await app.init();
  });
  afterEach(async () => { await app?.close(); });
  const refreshRequest = (app: INestApplication, token: string) => request(app.getHttpServer()).post('/api/auth/refresh')
    .set('Origin', origin).set('X-CSRF-Token', csrf).set('Cookie', [`refresh_token=${token}`, `csrf_token=${csrf}`]);

  it('returns 200 with cookie replacement only once; replay is 401 with no replacement cookie', async () => {
    const initial = await service.login({ ...user }); // setup only; no Login acceptance
    const valid = await refreshRequest(app, initial.refreshToken);
    expect(valid.status).toBe(200);
    expect(Array.isArray(valid.headers['set-cookie'])).toBe(true);
    expect((valid.headers['set-cookie'] as unknown as string[]).some(cookie => cookie.startsWith('refresh_token=') && cookie.includes('HttpOnly') && cookie.includes('Secure'))).toBe(true);
    expect('refreshToken' in valid.body).toBe(false);
    expect('refreshTokenHash' in valid.body).toBe(false);
    const stale = await refreshRequest(app, initial.refreshToken);
    expect(stale.status).toBe(401);
    expect(stale.headers['set-cookie'] === undefined).toBe(true);
  });

  it('maps CAS conflict to 401 without setting a cookie', async () => {
    const initial = await service.login({ ...user });
    rotate.mockResolvedValueOnce(false);
    const result = await refreshRequest(app, initial.refreshToken);
    expect(result.status).toBe(401);
    expect(result.headers['set-cookie'] === undefined).toBe(true);
  });

  it('still rejects missing CSRF with 403 before consuming the refresh token', async () => {
    const initial = await service.login({ ...user });
    const result = await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin', origin)
      .set('Cookie', [`refresh_token=${initial.refreshToken}`, `csrf_token=${csrf}`]);
    expect(result.status).toBe(403);
    expect(rotate).not.toHaveBeenCalled();
    expect(result.headers['set-cookie'] === undefined).toBe(true);
  });
});
