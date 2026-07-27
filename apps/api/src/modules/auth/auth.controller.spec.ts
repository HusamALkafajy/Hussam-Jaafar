/**
 * Token transport contract tests for AuthController.
 *
 * Verifies per-endpoint token transport without an HTTP server:
 *  - accessToken is present in the JSON response body
 *  - refresh_token is set as an httpOnly cookie (via response.cookie)
 *  - access_token is NEVER set as a cookie
 *  - refreshToken is never accepted from the JSON request body (refresh reads cookies only)
 *
 * Uses the existing Jest + @nestjs/testing convention.
 * No supertest or live DB required: AuthService and UsersService are fully mocked.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HttpStatus } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

// ─── Minimal mock AuthService ─────────────────────────────────────────────────

const mockTokenPair = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  user: { id: '1', email: 'user@test.com', firstName: 'Test', lastName: 'User', role: 'student', locale: 'en' },
};

const mockAuthService = {
  register: jest.fn().mockResolvedValue(mockTokenPair),
  validateUser: jest.fn().mockResolvedValue({ id: '1', email: 'user@test.com', firstName: 'Test', lastName: 'User', role: 'student' }),
  login: jest.fn().mockResolvedValue(mockTokenPair),
  refresh: jest.fn().mockResolvedValue(mockTokenPair),
  logout: jest.fn().mockResolvedValue(undefined),
  setAuthCookies: jest.fn(),
  clearAuthCookies: jest.fn(),
};

// ─── Mock express Response ────────────────────────────────────────────────────

function makeMockResponse() {
  const cookies: Record<string, { value: string; options: Record<string, unknown> }> = {};
  return {
    cookie: jest.fn((name: string, value: string, options: Record<string, unknown>) => {
      cookies[name] = { value, options };
    }),
    _cookies: cookies,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('AuthController — token transport contract', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  // ── POST /auth/register ─────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('returns accessToken in JSON body', async () => {
      mockAuthService.register.mockResolvedValueOnce(mockTokenPair);
      const res = makeMockResponse();
      const result = await controller.register(
        { email: 'a@b.com', password: 'P@ssword1', firstName: 'A', lastName: 'B' } as any,
        res as any,
      );
      // setAuthCookies is called on the service; the controller returns body directly
      expect(result).toEqual(
        expect.objectContaining({ accessToken: mockTokenPair.accessToken }),
      );
    });

    it('delegates cookie setting to setAuthCookies (not directly on response)', async () => {
      mockAuthService.register.mockResolvedValueOnce(mockTokenPair);
      const res = makeMockResponse();
      await controller.register(
        { email: 'a@b.com', password: 'P@ssword1', firstName: 'A', lastName: 'B' } as any,
        res as any,
      );
      // Controller must call setAuthCookies — NOT write cookies directly
      // The full result (including user) is passed; we assert on token fields only.
      expect(mockAuthService.setAuthCookies).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          accessToken: mockTokenPair.accessToken,
          refreshToken: mockTokenPair.refreshToken,
        }),
      );
      // Controller must NOT call res.cookie directly with access_token
      expect(res.cookie).not.toHaveBeenCalledWith(
        'access_token',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ── POST /auth/login ────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns accessToken in JSON body', async () => {
      mockAuthService.validateUser.mockResolvedValueOnce({ id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'student' });
      mockAuthService.login.mockResolvedValueOnce(mockTokenPair);
      const res = makeMockResponse();
      const result = await controller.login(
        { email: 'a@b.com', password: 'P@ssword1' },
        res as any,
      );
      expect(result).toEqual(
        expect.objectContaining({ accessToken: mockTokenPair.accessToken }),
      );
    });

    it('does not set access_token cookie', async () => {
      mockAuthService.validateUser.mockResolvedValueOnce({ id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'student' });
      mockAuthService.login.mockResolvedValueOnce(mockTokenPair);
      const res = makeMockResponse();
      await controller.login({ email: 'a@b.com', password: 'P@ssword1' }, res as any);
      // The controller delegates to setAuthCookies; it must not call res.cookie('access_token')
      expect(res.cookie).not.toHaveBeenCalledWith(
        'access_token',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ── POST /auth/refresh ──────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('reads refresh_token from cookie — not from request body', async () => {
      mockAuthService.refresh.mockResolvedValueOnce(mockTokenPair);
      const res = makeMockResponse();

      // Request with a cookie but also a body refreshToken (body must be ignored)
      const req = {
        cookies: { refresh_token: 'valid-cookie-refresh-token' },
        body: { refreshToken: 'body-should-be-ignored' },
      };

      await controller.refresh(req as any, res as any);

      // Service was called with the cookie value, not the body value
      expect(mockAuthService.refresh).toHaveBeenCalledWith('valid-cookie-refresh-token');
      expect(mockAuthService.refresh).not.toHaveBeenCalledWith('body-should-be-ignored');
    });

    it('rejects with 401 when no refresh_token cookie is present', async () => {
      const res = makeMockResponse();
      const req = { cookies: {}, body: {} };

      await expect(controller.refresh(req as any, res as any)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });

      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('returns accessToken in JSON body on success', async () => {
      mockAuthService.refresh.mockResolvedValueOnce(mockTokenPair);
      const res = makeMockResponse();
      const req = { cookies: { refresh_token: 'valid-token' }, body: {} };

      const result = await controller.refresh(req as any, res as any);
      expect(result).toEqual(
        expect.objectContaining({ accessToken: mockTokenPair.accessToken }),
      );
    });

    it('does not set access_token cookie on refresh', async () => {
      mockAuthService.refresh.mockResolvedValueOnce(mockTokenPair);
      const res = makeMockResponse();
      const req = { cookies: { refresh_token: 'valid-token' }, body: {} };
      await controller.refresh(req as any, res as any);
      expect(res.cookie).not.toHaveBeenCalledWith(
        'access_token',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ── setAuthCookies (service method) ─────────────────────────────────────────

  describe('AuthService.setAuthCookies — cookie attribute contract', () => {
    function captureCookies(nodeEnv: 'production' | 'development' | 'test') {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'NODE_ENV') return nodeEnv;
          return undefined;
        }),
      };
      const service = new (require('./auth.service').AuthService)(
        {} as any,
        {} as any,
        mockConfig as any,
      );

      const cookies: Array<{ name: string; value: string; options: any }> = [];
      const mockRes = {
        cookie: jest.fn((name: string, value: string, options: any) => {
          cookies.push({ name, value, options });
        }),
      };

      service.setAuthCookies(mockRes as any, {
        accessToken: 'at',
        refreshToken: 'rt',
      });

      return cookies;
    }

    it('sets Secure on authentication cookies in production', () => {
      const cookies = captureCookies('production');
      expect(cookies.find((c) => c.name === 'refresh_token')?.options.secure).toBe(true);
      expect(cookies.find((c) => c.name === 'csrf_token')?.options.secure).toBe(true);
    });

    it.each(['development', 'test'] as const)(
      'allows authentication cookies over approved local HTTP in %s',
      (nodeEnv) => {
        const cookies = captureCookies(nodeEnv);
        expect(cookies.find((c) => c.name === 'refresh_token')?.options.secure).toBe(false);
        expect(cookies.find((c) => c.name === 'csrf_token')?.options.secure).toBe(false);
      },
    );

    it('retains HttpOnly refresh protection and the intended SameSite contract', () => {
      const cookies = captureCookies('production');
      const refreshCookie = cookies.find((c) => c.name === 'refresh_token');
      const csrfCookie = cookies.find((c) => c.name === 'csrf_token');

      expect(refreshCookie?.options).toEqual(
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
      expect(csrfCookie?.options).toEqual(
        expect.objectContaining({ httpOnly: false, sameSite: 'lax' }),
      );
      expect(cookies.find((c) => c.name === 'access_token')).toBeUndefined();
    });
  });
});
