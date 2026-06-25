/**
 * Tests for apps/web/src/hooks/use-auth.tsx — AuthProvider behavior
 *
 * Covers:
 *  6. initial refresh restores authenticated session
 *  7. failed initial refresh produces unauthenticated state
 *  8. logout cannot be overwritten by a late refresh result (generation counter)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mock next/navigation ──────────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}));

// ── Mock api-client ───────────────────────────────────────────────────────────
// We mock the entire api-client module so tests control exactly what /auth/refresh returns.
const mockApiPost = vi.fn();
const mockApiGet = vi.fn();
const mockSetAccessToken = vi.fn();
let authExpiredHandler: (() => void) | null = null;

vi.mock('../src/lib/api-client', () => ({
  api: {
    post: (...args: any[]) => mockApiPost(...args),
    get: (...args: any[]) => mockApiGet(...args),
  },
  setAccessToken: (token: any) => mockSetAccessToken(token),
  onAuthExpired: (handler: () => void) => {
    authExpiredHandler = handler;
    return () => { authExpiredHandler = null; };
  },
  AuthExpiredError: class AuthExpiredError extends Error {
    constructor() { super('AUTH_EXPIRED'); this.name = 'AuthExpiredError'; }
  },
}));

// ── Import subject AFTER mocks ────────────────────────────────────────────────
import { AuthProvider, useAuth } from '../src/hooks/use-auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

const mockUser = { id: '1', email: 'user@test.com', firstName: 'Test', lastName: 'User', role: 'student' };

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AuthProvider — session lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    authExpiredHandler = null;
    // Clear storage (belt-and-suspenders)
    localStorage.clear();
    sessionStorage.clear();
  });

  it('6: initial refresh success → authenticated state, token in memory not storage', async () => {
    mockApiPost.mockResolvedValueOnce({
      user: mockUser,
      accessToken: 'fresh-access-token',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // While refresh is in flight: loading=true, user=null → protected route shows spinner
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    // After success: user is set
    expect(result.current.user).toEqual(mockUser);
    // setAccessToken called with the received token
    expect(mockSetAccessToken).toHaveBeenCalledWith('fresh-access-token');
    // Token not in Web Storage
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(sessionStorage.getItem('access_token')).toBeNull();
    // Router did NOT redirect to login
    expect(mockPush).not.toHaveBeenCalledWith('/login');
  });

  it('7: failed initial refresh → unauthenticated state, token cleared', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('401 Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Still loading while request is in flight
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    // After failure: user is null
    expect(result.current.user).toBeNull();
    // Memory token cleared
    expect(mockSetAccessToken).toHaveBeenCalledWith(undefined);
    // No access token in storage
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(sessionStorage.getItem('access_token')).toBeNull();
  });

  it('8: logout invalidates a concurrent in-flight refresh result (generation counter)', async () => {
    // Simulate a slow refresh that resolves AFTER logout fires
    let resolveRefresh!: (value: any) => void;
    const slowRefresh = new Promise<any>((res) => { resolveRefresh = res; });
    mockApiPost
      .mockReturnValueOnce(slowRefresh) // /auth/refresh (slow)
      .mockResolvedValue({}); // /auth/logout

    const { result } = renderHook(() => useAuth(), { wrapper });
    // Still loading, slow refresh in flight
    expect(result.current.loading).toBe(true);

    // Fire logout while refresh is still pending
    await act(async () => {
      result.current.logout();
    });

    // After logout: user cleared, redirected to /login
    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');

    // Now let the stale refresh resolve with a user
    await act(async () => {
      resolveRefresh({ user: mockUser, accessToken: 'stale-token' });
      // Allow microtasks to settle
      await new Promise((r) => setTimeout(r, 0));
    });

    // The late result must be discarded — user must remain null
    expect(result.current.user).toBeNull();
  });

  it('8b: onAuthExpired signal from 401 recovery clears auth state and redirects', async () => {
    // Arrange: start authenticated
    mockApiPost.mockResolvedValueOnce({ user: mockUser, accessToken: 'tok' });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(mockUser);

    // Fire the auth-expired event (simulates api-client calling _notifyAuthExpired)
    await act(async () => {
      authExpiredHandler?.();
    });

    expect(result.current.user).toBeNull();
    expect(mockSetAccessToken).toHaveBeenLastCalledWith(undefined);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
