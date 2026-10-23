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
import type { Locale } from '@studyai/types';
import { Locale as ProfileLocale, UserRole, SubscriptionTier, type UserProfileResponse } from '@studyai/types';

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
const credentialInput = ['Valid', 'Pass', '123!'].join('');

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

  it('7b: valid login establishes state and redirects to files', async () => {
    mockApiPost
      .mockRejectedValueOnce(new Error('No existing session'))
      .mockResolvedValueOnce({ user: mockUser, accessToken: 'login-access-token' });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('user@test.com', 'TestPass123!');
    });

    expect(mockApiPost).toHaveBeenLastCalledWith(
      '/auth/login',
      { email: 'user@test.com', password: 'TestPass123!' },
      undefined,
    );
    expect(mockSetAccessToken).toHaveBeenLastCalledWith('login-access-token');
    expect(result.current.user).toEqual(mockUser);
    expect(mockPush).toHaveBeenCalledWith('/files');
  });

  it('7c: valid registration preserves the typed payload and establishes state', async () => {
    const registerPayload = {
      email: 'new.user@example.test',
      password: credentialInput,
      firstName: 'New',
      lastName: 'User',
      locale: 'en' as Locale,
    };
    mockApiPost
      .mockRejectedValueOnce(new Error('No existing session'))
      .mockResolvedValueOnce({ user: mockUser, accessToken: 'registration-access-token' });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.register(registerPayload);
    });

    expect(mockApiPost).toHaveBeenLastCalledWith('/auth/register', registerPayload, undefined);
    expect(mockSetAccessToken).toHaveBeenLastCalledWith('registration-access-token');
    expect(result.current.user).toEqual(mockUser);
    expect(mockPush).toHaveBeenCalledWith('/files');
  });

  it.each(['login', 'register'] as const)('%s preserves the original structured error', async (operation) => {
    const structuredError = Object.assign(new Error('safe error'), {
      name: 'ApiError',
      status: 409,
      kind: 'http',
    });
    mockApiPost
      .mockRejectedValueOnce(new Error('No existing session'))
      .mockRejectedValueOnce(structuredError);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let caught: unknown;
    await act(async () => {
      try {
        if (operation === 'login') {
          await result.current.login('user@example.test', 'ValidPass123!');
        } else {
          await result.current.register({
            email: 'user@example.test',
            password: credentialInput,
            firstName: 'Test',
            lastName: 'User',
            locale: 'en' as Locale,
          });
        }
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBe(structuredError);
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

// Role/auth remediation: guarded canonical profile and lifecycle ownership.
const canonicalProfile: UserProfileResponse = {
  id: 'profile-user',
  email: 'profile@example.test',
  firstName: 'Canonical',
  lastName: 'Profile',
  avatarUrl: null,
  role: UserRole.STUDENT,
  locale: ProfileLocale.EN,
  subscriptionTier: SubscriptionTier.FREE,
  emailVerified: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function deferredResult<T>() {
  let complete: ((value: T) => void) | undefined;
  let fail: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    complete = resolve;
    fail = reject;
  });
  return {
    promise,
    resolve(value: T) {
      if (!complete) throw new Error('Deferred result not initialized');
      complete(value);
    },
    reject(reason: unknown) {
      if (!fail) throw new Error('Deferred result not initialized');
      fail(reason);
    },
  };
}

describe('AuthProvider — canonical profile and transition ownership', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
    mockApiGet.mockReset();
    mockSetAccessToken.mockReset();
    mockPush.mockReset();
    authExpiredHandler = null;
    localStorage.clear();
    sessionStorage.clear();
  });

  async function restoredSession() {
    mockApiPost.mockResolvedValueOnce({
      user: canonicalProfile,
      accessToken: 'initial-memory-token',
    });
    const hook = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  }

  it('profile revalidation loads the direct guarded canonical id-bearing profile', async () => {
    const hook = await restoredSession();
    const profile = deferredResult<UserProfileResponse>();
    const updated = { ...canonicalProfile, id: 'updated-profile', firstName: 'Updated' };
    mockApiGet.mockReturnValueOnce(profile.promise);
    let pending: Promise<void> | undefined;
    act(() => { pending = hook.result.current.checkSession(); });
    expect(hook.result.current.loading).toBe(true);
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/users/profile');
    await act(async () => { profile.resolve(updated); await pending; });
    expect(hook.result.current.user).toEqual(updated);
    expect(hook.result.current.user?.id).toBe('updated-profile');
    expect(hook.result.current.user?.firstName).toBe('Updated');
    expect(hook.result.current.loading).toBe(false);
    expect(mockApiGet).not.toHaveBeenCalledWith('/auth/me');
  });

  it('owning profile failure clears user and loading without a fallback request', async () => {
    const hook = await restoredSession();
    mockApiGet.mockRejectedValueOnce(new Error('Profile unavailable'));
    await act(async () => { await hook.result.current.checkSession(); });
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.loading).toBe(false);
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/users/profile');
  });

  const invalidProfiles: Array<{ label: string; value: unknown }> = [
    { label: 'null profile', value: null },
    { label: 'absent profile', value: undefined },
    { label: 'missing id', value: { role: UserRole.ADMIN } },
    { label: 'blank id', value: { ...canonicalProfile, id: '  ' } },
    { label: 'non-string id', value: { ...canonicalProfile, id: 17 } },
    { label: 'missing role', value: { id: canonicalProfile.id } },
    { label: 'null role', value: { ...canonicalProfile, role: null } },
    { label: 'empty role', value: { ...canonicalProfile, role: '' } },
    { label: 'unknown role', value: { ...canonicalProfile, role: 'administrator' } },
    { label: 'uppercase role', value: { ...canonicalProfile, role: 'ADMIN' } },
  ];
  it.each(invalidProfiles)('$label fails closed at the canonical profile boundary', async ({ value }) => {
    const hook = await restoredSession();
    mockApiGet.mockResolvedValueOnce(value);
    await act(async () => { await hook.result.current.checkSession(); });
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.loading).toBe(false);
    expect(mockApiGet).toHaveBeenCalledTimes(1);
  });

  it('does not start profile revalidation during initial refresh', async () => {
    const refresh = deferredResult<{ user: UserProfileResponse; accessToken: string }>();
    mockApiPost.mockReturnValueOnce(refresh.promise);
    const hook = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await hook.result.current.checkSession(); });
    expect(mockApiGet).not.toHaveBeenCalled();
    expect(hook.result.current.loading).toBe(true);
    await act(async () => {
      refresh.resolve({ user: canonicalProfile, accessToken: 'restored-memory-token' });
      await refresh.promise;
    });
    expect(hook.result.current.loading).toBe(false);
  });

  it('admits only one same-tick profile revalidation and retains its loading ownership', async () => {
    const hook = await restoredSession();
    const profile = deferredResult<UserProfileResponse>();
    mockApiGet.mockReturnValueOnce(profile.promise);
    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    act(() => {
      first = hook.result.current.checkSession();
      second = hook.result.current.checkSession();
    });
    await act(async () => { await second; });
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(hook.result.current.loading).toBe(true);
    await act(async () => { profile.resolve(canonicalProfile); await first; });
    expect(hook.result.current.loading).toBe(false);
  });

  it.each(['logout', 'expired'])('late profile cannot resurrect user after %s', async (transition) => {
    const hook = await restoredSession();
    const profile = deferredResult<UserProfileResponse>();
    mockApiGet.mockReturnValueOnce(profile.promise);
    let pending: Promise<void> | undefined;
    act(() => { pending = hook.result.current.checkSession(); });
    if (transition === 'logout') {
      mockApiPost.mockResolvedValueOnce({});
      await act(async () => { await hook.result.current.logout(); });
    } else {
      act(() => {
        if (!authExpiredHandler) throw new Error('Auth-expired listener missing');
        authExpiredHandler();
      });
    }
    await act(async () => {
      profile.resolve({ ...canonicalProfile, role: UserRole.ADMIN });
      await pending;
    });
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.loading).toBe(false);
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(mockSetAccessToken).toHaveBeenLastCalledWith(undefined);
  });

  it.each(['resolve', 'reject'])('stale profile %s cannot clear a newer pending login', async (outcome) => {
    const hook = await restoredSession();
    const profile = deferredResult<UserProfileResponse>();
    const login = deferredResult<{ user: UserProfileResponse; accessToken: string }>();
    mockApiGet.mockReturnValueOnce(profile.promise);
    mockApiPost.mockReturnValueOnce(login.promise);
    let profilePending: Promise<void> | undefined;
    let loginPending: Promise<void> | undefined;
    act(() => { profilePending = hook.result.current.checkSession(); });
    act(() => { loginPending = hook.result.current.login('new@example.test', credentialInput); });
    await act(async () => {
      if (outcome === 'resolve') profile.resolve({ ...canonicalProfile, role: UserRole.ADMIN });
      else profile.reject(new Error('Late profile failure'));
      await profilePending;
    });
    expect(hook.result.current.loading).toBe(true);
    expect(hook.result.current.user).toEqual(canonicalProfile);
    const newUser = { ...canonicalProfile, id: 'new-session' };
    await act(async () => {
      login.resolve({ user: newUser, accessToken: 'new-memory-token' });
      await loginPending;
    });
    expect(hook.result.current.user).toEqual(newUser);
    expect(hook.result.current.loading).toBe(false);
    expect(mockSetAccessToken).toHaveBeenLastCalledWith('new-memory-token');
  });

  const logoutRaces: Array<{ action: 'login' | 'register'; laterSettled: boolean }> = [
    { action: 'login', laterSettled: false },
    { action: 'register', laterSettled: false },
    { action: 'login', laterSettled: true },
    { action: 'register', laterSettled: true },
  ];
  it.each(logoutRaces)('old logout cannot clobber $action, settled=$laterSettled', async ({ action, laterSettled }) => {
    const hook = await restoredSession();
    const logout = deferredResult<unknown>();
    const later = deferredResult<{ user: UserProfileResponse; accessToken: string }>();
    mockApiPost.mockReturnValueOnce(logout.promise).mockReturnValueOnce(later.promise);
    let logoutPending: Promise<void> | undefined;
    let laterPending: Promise<void> | undefined;
    act(() => { logoutPending = hook.result.current.logout(); });
    act(() => {
      laterPending = action === 'login'
        ? hook.result.current.login('later@example.test', credentialInput)
        : hook.result.current.register({
            email: 'later@example.test',
            password: credentialInput,
            firstName: 'Later',
            lastName: 'User',
            locale: ProfileLocale.EN,
          });
    });
    const laterUser = { ...canonicalProfile, id: 'later-session' };
    if (laterSettled) {
      await act(async () => {
        later.resolve({ user: laterUser, accessToken: 'later-memory-token' });
        await laterPending;
      });
    }
    await act(async () => { logout.resolve({}); await logoutPending; });
    expect(mockPush).not.toHaveBeenCalledWith('/login');
    expect(hook.result.current.loading).toBe(!laterSettled);
    expect(hook.result.current.user).toEqual(laterSettled ? laterUser : canonicalProfile);
    if (!laterSettled) {
      await act(async () => {
        later.resolve({ user: laterUser, accessToken: 'later-memory-token' });
        await laterPending;
      });
    }
    expect(hook.result.current.user).toEqual(laterUser);
    expect(hook.result.current.loading).toBe(false);
    expect(mockSetAccessToken).toHaveBeenLastCalledWith('later-memory-token');
  });
});
