import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Locale, SubscriptionTier, UserRole, type UserProfileResponse } from '@studyai/types';

const transport = vi.hoisted(() => {
  const listeners: { expired?: () => void } = {};
  return { post: vi.fn(), get: vi.fn(), setToken: vi.fn(), push: vi.fn(), listeners };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: transport.push }),
  useSearchParams: () => ({ get: () => null }),
}));
vi.mock('../src/lib/api-client', () => ({
  api: { post: transport.post, get: transport.get },
  setAccessToken: transport.setToken,
  onAuthExpired: (callback: () => void) => {
    transport.listeners.expired = callback;
    return () => { delete transport.listeners.expired; };
  },
}));

import { AuthProvider, useAuth } from '../src/hooks/use-auth';
import { SecurityProvider, useSecurity } from '../src/components/security/security-provider';

type Observation = {
  loading: boolean;
  context: ReturnType<typeof useSecurity>['context'];
  audits: ReturnType<typeof useSecurity>['audits'];
  compliance: ReturnType<typeof useSecurity>['compliance'];
};

function deferred<T>() {
  let finish: ((value: T) => void) | undefined;
  let fail: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => { finish = resolve; fail = reject; });
  return {
    promise,
    resolve(value: T) {
      if (!finish) throw new Error('Deferred result not initialized');
      finish(value);
    },
    reject(reason: unknown) {
      if (!fail) throw new Error('Deferred result not initialized');
      fail(reason);
    },
  };
}

const makeProfile = (role: UserRole): UserProfileResponse => ({
  id: 'canonical-security-user',
  email: 'security@example.test',
  firstName: 'Security',
  lastName: 'User',
  avatarUrl: null,
  role,
  locale: Locale.EN,
  subscriptionTier: SubscriptionTier.FREE,
  emailVerified: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

describe('SecurityProvider — current auth, canonical id and default deny', () => {
  let latestAuth: ReturnType<typeof useAuth> | undefined;
  let observed: Observation[];

  function Probe() {
    const auth = useAuth();
    const security = useSecurity();
    latestAuth = auth;
    observed.push({ loading: auth.loading, ...security });
    return <span data-testid="security-state">{security.context?.identityId ?? 'closed'}</span>;
  }
  function mount() {
    return render(<AuthProvider><SecurityProvider><Probe /></SecurityProvider></AuthProvider>);
  }
  function currentAuth() {
    if (!latestAuth) throw new Error('Auth probe not mounted');
    return latestAuth;
  }
  function currentState() {
    const state = observed[observed.length - 1];
    if (!state) throw new Error('Security probe not rendered');
    return state;
  }
  function assertClosed(states: Observation[] = [currentState()]) {
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) {
      expect(state.context).toBeNull();
      expect(state.audits).toEqual([]);
      expect(state.compliance).toEqual({ flagsActive: 0, rulesActive: 0 });
    }
  }
  async function settled(role: UserRole = UserRole.ADMIN) {
    transport.post.mockResolvedValueOnce({ user: makeProfile(role), accessToken: 'unit-memory-token' });
    mount();
    await waitFor(() => expect(currentAuth().loading).toBe(false));
  }

  beforeEach(() => {
    transport.post.mockReset();
    transport.get.mockReset();
    transport.setToken.mockReset();
    transport.push.mockReset();
    delete transport.listeners.expired;
    latestAuth = undefined;
    observed = [];
  });
  afterEach(cleanup);

  const knownRoles: Array<{ role: UserRole; permissions: string[] }> = [
    { role: UserRole.ADMIN, permissions: ['document.read', 'document.write', 'admin.manage'] },
    { role: UserRole.STUDENT, permissions: ['document.read', 'document.write'] },
    { role: UserRole.TEACHER, permissions: ['document.read', 'document.write'] },
    { role: UserRole.PARENT, permissions: ['document.read', 'document.write'] },
  ];
  it.each(knownRoles)('$role retains only its explicit intended permission set', async ({ role, permissions }) => {
    await settled(role);
    expect(currentState().context).toEqual({
      identityId: 'canonical-security-user',
      activeRoles: [role],
      permissions,
    });
    expect(currentState().audits).toEqual([]);
    expect(JSON.stringify(observed)).not.toContain('usr_admin_123');
    expect(JSON.stringify(observed)).not.toContain('Administrator');
  });

  it('initial unresolved auth exposes no identity, permission or mock audit', async () => {
    const refresh = deferred<{ user: UserProfileResponse; accessToken: string }>();
    transport.post.mockReturnValueOnce(refresh.promise);
    mount();
    expect(currentAuth().loading).toBe(true);
    assertClosed(observed);
    await act(async () => {
      refresh.resolve({ user: makeProfile(UserRole.STUDENT), accessToken: 'unit-student-token' });
      await refresh.promise;
    });
  });

  it('unauthenticated refresh failure remains closed', async () => {
    transport.post.mockRejectedValueOnce(new Error('No session'));
    mount();
    await waitFor(() => expect(currentAuth().loading).toBe(false));
    expect(currentAuth().user).toBeNull();
    assertClosed(observed);
  });

  const invalidUsers: Array<{ label: string; user: unknown }> = [
    { label: 'no user', user: null },
    { label: 'undefined user', user: undefined },
    { label: 'missing role', user: { id: 'actual-user' } },
    { label: 'undefined role', user: { ...makeProfile(UserRole.ADMIN), role: undefined } },
    { label: 'null role', user: { ...makeProfile(UserRole.ADMIN), role: null } },
    { label: 'empty role', user: { ...makeProfile(UserRole.ADMIN), role: '' } },
    { label: 'unknown role', user: { ...makeProfile(UserRole.ADMIN), role: 'owner' } },
    { label: 'uppercase role', user: { ...makeProfile(UserRole.ADMIN), role: 'ADMIN' } },
    { label: 'missing id', user: { role: UserRole.ADMIN } },
    { label: 'null id', user: { ...makeProfile(UserRole.ADMIN), id: null } },
    { label: 'blank id', user: { ...makeProfile(UserRole.ADMIN), id: '  ' } },
    { label: 'non-string id', user: { ...makeProfile(UserRole.ADMIN), id: 17 } },
  ];
  it.each(invalidUsers)('$label cannot receive document or admin permission fallback', async ({ user }) => {
    transport.post.mockResolvedValueOnce({ user, accessToken: 'unit-memory-token' });
    mount();
    await waitFor(() => expect(currentAuth().loading).toBe(false));
    assertClosed(observed);
  });

  it('FIRST loading render after prior admin denies stale privileges during revalidation', async () => {
    await settled();
    expect(currentState().context?.permissions).toContain('admin.manage');
    const profile = deferred<UserProfileResponse>();
    transport.get.mockReturnValueOnce(profile.promise);
    observed.length = 0;
    let pending: Promise<void> | undefined;
    act(() => { pending = currentAuth().checkSession(); });
    expect(currentAuth().user?.role).toBe(UserRole.ADMIN);
    expect(currentAuth().loading).toBe(true);
    expect(observed[0]?.loading).toBe(true);
    assertClosed(observed);
    const student = { ...makeProfile(UserRole.STUDENT), id: 'revalidated-student' };
    await act(async () => { profile.resolve(student); await pending; });
    expect(transport.get).toHaveBeenCalledTimes(1);
    expect(transport.get).toHaveBeenCalledWith('/users/profile');
    expect(currentState().context).toEqual({
      identityId: 'revalidated-student',
      activeRoles: [UserRole.STUDENT],
      permissions: ['document.read', 'document.write'],
    });
    expect(currentState().audits).toEqual([]);
    for (const state of observed.filter(state => !state.loading)) {
      expect(state.context?.permissions).not.toContain('admin.manage');
    }
  });

  it('profile failure clears previous admin without a successful-login audit', async () => {
    await settled();
    transport.get.mockRejectedValueOnce(new Error('Profile unavailable'));
    await act(async () => { await currentAuth().checkSession(); });
    expect(currentAuth().user).toBeNull();
    expect(currentAuth().loading).toBe(false);
    assertClosed();
  });

  it('logout start and completion expose no stale admin permissions', async () => {
    await settled();
    const logout = deferred<unknown>();
    transport.post.mockReturnValueOnce(logout.promise);
    observed.length = 0;
    let pending: Promise<void> | undefined;
    act(() => { pending = currentAuth().logout(); });
    expect(currentAuth().loading).toBe(true);
    expect(currentAuth().user?.role).toBe(UserRole.ADMIN);
    assertClosed(observed);
    await act(async () => { logout.resolve({}); await pending; });
    expect(currentAuth().loading).toBe(false);
    expect(currentAuth().user).toBeNull();
    assertClosed(observed);
  });

  it('auth expiry clears an admin context on the same render, without an effect lag', async () => {
    await settled();
    observed.length = 0;
    act(() => {
      const expire = transport.listeners.expired;
      if (!expire) throw new Error('Auth-expired listener missing');
      expire();
    });
    expect(currentAuth().user).toBeNull();
    assertClosed(observed);
  });
});
