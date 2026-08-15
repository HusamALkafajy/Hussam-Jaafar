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
    fetchSpy.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return refreshSuccessResponse();
      }
      // Mark retries by checking Authorization header
      const headers = new Headers(init?.headers);
      const auth = headers.get('Authorization');
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

describe('api-client — structured failure contract', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('preserves HTTP status without exposing a backend message', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      success: false,
      message: 'internal stack and database details',
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
    const { api, ApiError } = await import('../src/lib/api-client');

    const error = await api.post('/auth/register', {}).catch((value) => value);
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/auth/register');
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, kind: 'http', message: 'Request conflict.' });
    expect(error.message).not.toContain('database');
  });

  it('handles a non-JSON error without exposing raw HTML', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('<html>private proxy error</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    }));
    const { api } = await import('../src/lib/api-client');

    const error = await api.get('/data').catch((value) => value);
    expect(error).toMatchObject({ status: 502, kind: 'http', message: 'Server request failed.' });
    expect(error.message).not.toContain('<html>');
  });

  it('maps network failures distinctly', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('connection details'));
    const { api } = await import('../src/lib/api-client');

    await expect(api.get('/data')).rejects.toMatchObject({
      status: 0,
      kind: 'network',
      message: 'Network request failed.',
    });
  });

  it('distinguishes timeout from caller cancellation', async () => {
    vi.useFakeTimers();
    fetchSpy.mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const { api } = await import('../src/lib/api-client');

    const request = api.get('/slow', { timeout: 10 });
    const assertion = expect(request).rejects.toMatchObject({ status: 504, kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    vi.useRealTimers();
    const caller = new AbortController();
    const cancelled = api.get('/slow', { signal: caller.signal });
    const cancelledAssertion = expect(cancelled).rejects.toMatchObject({
      status: 0,
      kind: 'aborted',
    });
    caller.abort();
    await cancelledAssertion;
  });

  it('accepts a successful 204 response without parsing JSON', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { api } = await import('../src/lib/api-client');
    await expect(api.delete('/resource')).resolves.toBeUndefined();
  });

  it('preserves the CSRF header across a 401 refresh retry', async () => {
    document.cookie = 'csrf_token=csrf-value; path=/';
    let protectedCalls = 0;
    fetchSpy.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.endsWith('/api/auth/refresh')) {
        expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-value');
        return refreshSuccessResponse('refreshed-token');
      }
      protectedCalls += 1;
      expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-value');
      return protectedCalls === 1 ? unauthorizedResponse() : successResponse({ ok: true });
    });
    const { api, setAccessToken } = await import('../src/lib/api-client');
    setAccessToken('expired-token');

    await expect(api.post('/protected', { value: 1 })).resolves.toEqual({ ok: true });
    expect(protectedCalls).toBe(2);
  });

  it('retries a FormData upload after refresh without losing its body', async () => {
    document.cookie = 'csrf_token=upload-csrf; path=/';
    const upload = new FormData();
    upload.append('fileSize', '1024');
    let uploadCalls = 0;
    fetchSpy.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.endsWith('/api/auth/refresh')) {
        expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('upload-csrf');
        return refreshSuccessResponse('fresh-upload-token');
      }
      uploadCalls += 1;
      expect(init?.body).toBe(upload);
      return uploadCalls === 1 ? unauthorizedResponse() : successResponse({ id: 'file-1' });
    });
    const { api, setAccessToken } = await import('../src/lib/api-client');
    setAccessToken('expired-upload-token');

    await expect(api.post('/files/upload/chunk', upload)).resolves.toEqual({ id: 'file-1' });
    expect(uploadCalls).toBe(2);
  });

  it('keeps authenticated binary delivery outside JSON parsing', async () => {
    const binaryResponse = new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });
    fetchSpy.mockResolvedValueOnce(binaryResponse);
    const { authenticatedFetch, setAccessToken } = await import('../src/lib/api-client');
    setAccessToken('memory-token');

    const response = await authenticatedFetch('/files/file-id/original');
    expect(response).toBe(binaryResponse);
    expect(fetchSpy).toHaveBeenCalledWith('/api/files/file-id/original', expect.objectContaining({
      credentials: 'include',
    }));
    const init = fetchSpy.mock.calls[0][1];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer memory-token');
  });
});
