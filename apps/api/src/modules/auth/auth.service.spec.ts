/**
 * Password reset atomicity tests for AuthService.resetPassword.
 *
 * These unit tests prove:
 *
 * 1. SUCCESS PATH:
 *    - db.transaction is called exactly once.
 *    - updatePassword, updateRefreshTokenHash(userId, null), and clearResetToken
 *      all receive the exact same transaction handle.
 *    - No persistence method falls back to the global db inside the transaction callback.
 *
 * 2. FAILURE PATH:
 *    - When updateRefreshTokenHash throws after updatePassword succeeds,
 *      the transaction callback rejects.
 *    - The Drizzle transaction mock rejects, representing rollback semantics.
 *    - clearResetToken is never called (the error propagates before it).
 *
 * 3. FAILURE PATH (clearResetToken):
 *    - When clearResetToken throws after the first two operations succeed,
 *      the transaction callback rejects.
 *    - The Drizzle transaction mock rejects.
 *
 * CAVEAT: Unit tests prove all operations share one transaction handle and
 * failure propagates; physical database rollback requires an integration test
 * with PostgreSQL.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

// ─── Mock @studyai/database ───────────────────────────────────────────────────
// The db.transaction mock captures the callback and runs it with a sentinel
// transaction handle. This lets us verify that the callback passes the tx
// to each UsersService method rather than letting them fall back to the global db.

// jest.mock is hoisted above const declarations, so the mock object AND the
// sentinel must be defined inside the factory. We retrieve them via require().
jest.mock('@studyai/database', () => {
  const SENTINEL_TX = { __sentinel: 'MOCK_TX' };
  const mockTransaction = jest.fn(async (callback: (tx: unknown) => Promise<void>) => {
    await callback(SENTINEL_TX);
  });
  return { db: { transaction: mockTransaction }, __MOCK_TX: SENTINEL_TX };
});

// Retrieve the mock db and sentinel after hoisting.
const { db: mockDb, __MOCK_TX: MOCK_TX } = require('@studyai/database') as {
  db: { transaction: jest.Mock };
  __MOCK_TX: unknown;
};

// ─── Mock UsersService ────────────────────────────────────────────────────────

const mockUsersService = {
  findByResetToken: jest.fn(),
  updatePassword: jest.fn().mockResolvedValue(undefined),
  updateRefreshTokenHash: jest.fn().mockResolvedValue(undefined),
  clearResetToken: jest.fn().mockResolvedValue(undefined),
};

// ─── Mock bcrypt ──────────────────────────────────────────────────────────────

jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('mock-salt'),
  hash: jest.fn().mockResolvedValue('hashed-new-password'),
  compare: jest.fn(),
}));

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AuthService.resetPassword — transaction atomicity', () => {
  let authService: AuthService;

  const validUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'student',
    resetToken: 'valid-token',
    resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SMTP_HOST') return undefined;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    // Default: valid user with unexpired reset token
    mockUsersService.findByResetToken.mockResolvedValue(validUser);
    mockUsersService.updatePassword.mockResolvedValue(undefined);
    mockUsersService.updateRefreshTokenHash.mockResolvedValue(undefined);
    mockUsersService.clearResetToken.mockResolvedValue(undefined);

    // Re-set the transaction mock to default (execute callback with sentinel tx)
    mockDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<void>) => {
        await callback(MOCK_TX);
      },
    );
  });

  // ─── SUCCESS PATH ───────────────────────────────────────────────────────────

  describe('success path', () => {
    it('calls db.transaction exactly once', async () => {
      await authService.resetPassword({ token: 'valid-token', newPassword: 'NewP@ss1' });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('passes the same transaction handle (tx) to all three persistence methods', async () => {
      await authService.resetPassword({ token: 'valid-token', newPassword: 'NewP@ss1' });

      // All three methods must have been called with MOCK_TX as the third argument.
      // This proves they received the transaction handle, not the global db.
      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(
        validUser.id,
        'hashed-new-password',
        MOCK_TX,
      );

      expect(mockUsersService.updateRefreshTokenHash).toHaveBeenCalledWith(
        validUser.id,
        null,
        MOCK_TX,
      );

      expect(mockUsersService.clearResetToken).toHaveBeenCalledWith(
        validUser.id,
        MOCK_TX,
      );
    });

    it('does not pass undefined as the transaction handle to any method', async () => {
      await authService.resetPassword({ token: 'valid-token', newPassword: 'NewP@ss1' });

      // Verify no method was called with undefined tx (which would mean fallback to global db)
      const updatePasswordTx = mockUsersService.updatePassword.mock.calls[0][2];
      const updateRefreshTx = mockUsersService.updateRefreshTokenHash.mock.calls[0][2];
      // clearResetToken(id, tx?) — tx is the 2nd param (index 1)
      const clearResetTx = mockUsersService.clearResetToken.mock.calls[0][1];

      expect(updatePasswordTx).toBe(MOCK_TX);
      expect(updateRefreshTx).toBe(MOCK_TX);
      expect(clearResetTx).toBe(MOCK_TX);

      // Extra: none of these should be undefined
      expect(updatePasswordTx).not.toBeUndefined();
      expect(updateRefreshTx).not.toBeUndefined();
      expect(clearResetTx).not.toBeUndefined();
    });
  });

  // ─── FAILURE PATH: updateRefreshTokenHash throws ────────────────────────────

  describe('failure path — updateRefreshTokenHash throws after updatePassword succeeds', () => {
    const refreshError = new Error('SIMULATED_REFRESH_TOKEN_HASH_FAILURE');

    beforeEach(() => {
      mockUsersService.updatePassword.mockResolvedValue(undefined);
      mockUsersService.updateRefreshTokenHash.mockRejectedValue(refreshError);
    });

    it('the transaction callback rejects', async () => {
      await expect(
        authService.resetPassword({ token: 'valid-token', newPassword: 'NewP@ss1' }),
      ).rejects.toThrow('SIMULATED_REFRESH_TOKEN_HASH_FAILURE');
    });

    it('db.transaction rejects (Drizzle rollback semantics)', async () => {
      // The mockDb.transaction awaits the callback, so when the callback throws,
      // transaction() itself rejects. In real Drizzle, this triggers a ROLLBACK.
      try {
        await authService.resetPassword({ token: 'valid-token', newPassword: 'NewP@ss1' });
        fail('Expected resetPassword to throw');
      } catch (e: any) {
        expect(e.message).toBe('SIMULATED_REFRESH_TOKEN_HASH_FAILURE');
      }

      // The transaction was called (and rejected)
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('clearResetToken is never called when updateRefreshTokenHash throws', async () => {
      try {
        await authService.resetPassword({ token: 'valid-token', newPassword: 'NewP@ss1' });
      } catch {
        // expected
      }

      // updatePassword was called (it succeeded before the throw)
      expect(mockUsersService.updatePassword).toHaveBeenCalledTimes(1);
      // updateRefreshTokenHash was called (it threw)
      expect(mockUsersService.updateRefreshTokenHash).toHaveBeenCalledTimes(1);
      // clearResetToken was never reached
      expect(mockUsersService.clearResetToken).not.toHaveBeenCalled();
    });
  });

  // ─── FAILURE PATH: clearResetToken throws ───────────────────────────────────

  describe('failure path — clearResetToken throws after first two operations succeed', () => {
    const clearError = new Error('SIMULATED_CLEAR_RESET_TOKEN_FAILURE');

    beforeEach(() => {
      mockUsersService.updatePassword.mockResolvedValue(undefined);
      mockUsersService.updateRefreshTokenHash.mockResolvedValue(undefined);
      mockUsersService.clearResetToken.mockRejectedValue(clearError);
    });

    it('the transaction callback rejects', async () => {
      await expect(
        authService.resetPassword({ token: 'valid-token', newPassword: 'NewP@ss1' }),
      ).rejects.toThrow('SIMULATED_CLEAR_RESET_TOKEN_FAILURE');
    });

    it('db.transaction rejects (Drizzle rollback semantics)', async () => {
      try {
        await authService.resetPassword({ token: 'valid-token', newPassword: 'NewP@ss1' });
        fail('Expected resetPassword to throw');
      } catch (e: any) {
        expect(e.message).toBe('SIMULATED_CLEAR_RESET_TOKEN_FAILURE');
      }

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('all three methods were called (first two succeeded, third threw)', async () => {
      try {
        await authService.resetPassword({ token: 'valid-token', newPassword: 'NewP@ss1' });
      } catch {
        // expected
      }

      expect(mockUsersService.updatePassword).toHaveBeenCalledTimes(1);
      expect(mockUsersService.updateRefreshTokenHash).toHaveBeenCalledTimes(1);
      expect(mockUsersService.clearResetToken).toHaveBeenCalledTimes(1);
    });
  });
});
