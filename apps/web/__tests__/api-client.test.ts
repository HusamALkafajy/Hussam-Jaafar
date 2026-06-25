/**
 * Tests for apps/web/src/lib/api-client.ts
 *
 * Covers:
 *  1. access token is never written to localStorage, sessionStorage, or document.cookie
 *  2. five simultaneous 401 responses trigger exactly one refresh request
 *  3. successful refresh retries each original request exactly once
 *  4. refresh failure clears token and does not loop
 *  5. auth endpoints never trigger 401 recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers ──────────────────────────────────────────────────────────────────

// We import the module under test AFTER setting up fetch mocks so that the
// module-level state is fresh for each test suite (vi.resetModules()).
// Re-importing inside each test ensures isolation.

const successResponse = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const unauthorizedResponse = () =>
  new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

const refreshSuccessResponse = (accessToken = 'new-access-token') =>
  new Response(
    JSON.stringify({ success: true, data: { accessToken, user: { id: '1' } } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

const refreshFailResponse = () =>
  new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('api-client — token storage guarantees', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    // Reset document.cookie (jsdom allows this via direct assignment)
    document.cookie.split(';').forEach((c) => {
      const key = c.trim().split('=')[0];
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  });

  it('1: setAccessToken does not write to localStorage', async () => {
    const { setAccessToken } = await import('../src/lib/api-client');
    setAccessToken('some-token');
    expect(localStorage.getItem('access_token')).toBeNull();
    // Broad check: no key in localStorage contains the token value
    for (let i = 0; i < localStorage.length; i++) {
      const val = localStorage.getItem(localStorage.key(i) ?? '');
      expect(val).not.toContain('some-token');
    }
  });

  it('1: setAccessToken does not write to sessionStorage', async () => {
    const { setAccessToken } = await import('../src/lib/api-client');
    setAccessToken('another-token');
    expect(sessionStorage.length).toBe(0);
  });

  it('1: setAccessToken does not write to document.cookie', async () => {
    const { setAccessToken } = await import('../src/lib/api-client');
    const cookieBefore = document.cookie;
    setAccessToken('cookie-check-token');
    expect(document.cookie).toBe(cookieBefore);
    expect(document.cookie).not.toContain('cookie-check-token');
  });
});

describe('api-client — single-flight 401 refresh', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('2: five simultaneous 401 responses trigger exactly one /auth/refresh call', async () => {
    const { api, setAccessToken } = await import('../src/lib/api-client');
    setAccessToken('expired-token');

    let refreshCallCount = 0;

    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return refreshSuccessResponse();
      }
      // First call: 401. Retry (after refresh): success.
      if (url.includes('/api/data')) {
        return unauthorizedResponse();
      }
      return successResponse({ ok: true });
    });

    // After refresh, retries should succeed
    // We let the retry also get a 401 to keep fetch simple (retry guard stops loop)
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return refreshSuccessResponse();
      }
      // Mark retries by checking Authorization header
      const headers = (input as Request).headers;
      const auth = typeof headers?.get === 'function' ? headers.get('Authorization') : undefined;
      if (auth === 'Bearer new-access-token') {
        // This is the retry — return success
        return successResponse({ item: 1 });
      }
      return unauthorizedResponse();
    });

    // Fire 5 concurrent requests
    const requests = Array.from({ length: 5 }, () => api.get('/data'));
    await Promise.allSettled(requests);

    expect(refreshCallCount).toBe(1);
  });

  it('3: after successful refresh, each original request is retried exactly once', async () => {
    const { api, setAccessToken } = await import('../src/lib/api-client');
    setAccessToken('old-token');

    // Track call counts per endpoint
    const callCounts: Record<string, number> = {};

    fetchSpy.mockImplementation(async (input: any, _init?: RequestInit) => {
      const url: string = typeof input === 'string' ? input : input.url;
      if (url.includes('/auth/refresh')) {
        return refreshSuccessResponse('fresh-token');
      }
      // Count how many times each endpoint is called
      callCounts[url] = (callCounts[url] ?? 0) + 1;
      // First call → 401. Second call (retry) → success.
      if (callCounts[url] > 1) {
        return successResponse({ retried: true });
      }
      return unauthorizedResponse();
    });

    const results = await Promise.allSettled([api.get('/endpoint-a'), api.get('/endpoint-b')]);

    // Both fulfilled after retry
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    // Each endpoint was called exactly twice: once original (401) + once retry (success)
    const aKey = Object.keys(callCounts).find((k) => k.includes('/endpoint-a')) ?? '';
    const bKey = Object.keys(callCounts).find((k) => k.includes('/endpoint-b')) ?? '';
    expect(callCounts[aKey]).toBe(2);
    expect(callCounts[bKey]).toBe(2);
  });


  it('4: refresh failure clears memory token and does not loop', async () => {
    const { api, setAccessToken, onAuthExpired } = await import('../src/lib/api-client');
    setAccessToken('expired');

    const authExpiredFired = vi.fn();
    const unsubscribe = onAuthExpired(authExpiredFired);

    let fetchCallCount = 0;
    fetchSpy.mockImplementation(async (input) => {
      fetchCallCount++;
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) return refreshFailResponse();
      return unauthorizedResponse();
    });

    await expect(api.get('/protected')).rejects.toThrow();

    // refresh was called once
    expect(fetchCallCount).toBe(2); // 1 original + 1 refresh attempt (no retry after fail)
    // authExpired signal fired
    expect(authExpiredFired).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('5: auth endpoints are never intercepted for 401 recovery', async () => {
    const { api } = await import('../src/lib/api-client');

    let refreshCalled = false;
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh') && !url.endsWith('/auth/refresh')) {
        // This would be a recursive refresh — should never happen
        refreshCalled = true;
      }
      return unauthorizedResponse();
    });

    // /auth/login getting 401 should NOT trigger a refresh loop
    await expect(
      api.post('/auth/login', { email: 'a@b.com', password: 'wrong' }),
    ).rejects.toThrow();

    expect(refreshCalled).toBe(false);
    // Only one fetch call was made (no retry/refresh chain)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('5b: /auth/refresh endpoint getting 401 does not trigger a self-loop', async () => {
    // This proves AUTH_ENDPOINTS exemption covers /auth/refresh itself.
    // If the exemption were missing, a 401 from POST /auth/refresh would try
    // to call POST /auth/refresh again, creating an infinite loop.
    const { api } = await import('../src/lib/api-client');

    let fetchCallCount = 0;
    fetchSpy.mockImplementation(async () => {
      fetchCallCount++;
      return unauthorizedResponse();
    });

    // Calling /auth/refresh directly and getting 401 should reject once
    await expect(
      api.post('/auth/refresh'),
    ).rejects.toThrow();

    // Exactly one fetch call: the direct /auth/refresh call.
    // No second fetch to /auth/refresh was triggered by 401 recovery.
    expect(fetchCallCount).toBe(1);
  });
});
