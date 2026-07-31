'use client';

import { ApiResponse } from '@studyai/types';

// ─── Browser-Only Auth Transport ─────────────────────────────────────────────
// This module MUST only execute in browser context.
// The 'use client' directive enforces Next.js tree-shaking at the RSC boundary.
// Do NOT import this file from Server Components, middleware, or route handlers.

/**
 * Structured error thrown when the backend returns QUOTA_EXCEEDED (HTTP 403).
 * Frontend components can instanceof-check this to show the correct UI.
 */
export class QuotaError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string = 'QUOTA_EXCEEDED',
    public readonly limitType: string = '',
    public readonly used: number = 0,
    public readonly limit: number = 0,
    public readonly tier: string = 'free',
    public readonly messageAr?: string,
  ) {
    super(message);
    this.name = 'QuotaError';
  }
}

/**
 * Sentinel error emitted when /auth/refresh fails during 401 recovery.
 * AuthProvider subscribes to onAuthExpired() and clears state on receipt.
 */
export class AuthExpiredError extends Error {
  constructor() {
    super('AUTH_EXPIRED');
    this.name = 'AuthExpiredError';
  }
}

// ─── Module-Level Memory Token ───────────────────────────────────────────────
// Lives only in browser JS heap; cleared on tab close or logout.
// Never written to localStorage, sessionStorage, IndexedDB, cookies, or URL params.

let _accessToken: string | undefined;

export const setAccessToken = (token: string | undefined): void => {
  _accessToken = token;
};

/**
 * Use for authenticated binary responses such as original documents. Callers
 * receive a Response rather than JSON, while credentials and the in-memory
 * bearer token stay off URLs and out of component state.
 */
export const authenticatedFetch = async (endpoint: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers || {});
  if (_accessToken) headers.set('Authorization', `Bearer ${_accessToken}`);
  return fetch(`${BASE_URL}/api${endpoint}`, {
    ...init,
    headers,
    credentials: 'include',
  });
};

// ─── Auth-Expired Pub/Sub ─────────────────────────────────────────────────────
// Allows AuthProvider to subscribe to token expiry events raised inside api-client.

type AuthExpiredHandler = () => void;
const _authExpiredHandlers: Set<AuthExpiredHandler> = new Set();

export const onAuthExpired = (handler: AuthExpiredHandler): (() => void) => {
  _authExpiredHandlers.add(handler);
  return () => _authExpiredHandlers.delete(handler);
};

const _notifyAuthExpired = (): void => {
  _authExpiredHandlers.forEach((h) => h());
};

// ─── Single-Flight Refresh Lock ───────────────────────────────────────────────
// At most one /auth/refresh call is in flight at any time.
// Concurrent 401 recoveries await the same promise.

let _refreshPromise: Promise<void> | null = null;

const AUTH_ENDPOINTS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]);

const BASE_URL = '';  // Client: empty string → relative, proxied by Next.js → api

// ─── Core Request ─────────────────────────────────────────────────────────────

type ExtendedRequestInit = RequestInit & {
  timeout?: number;
  _isRetry?: boolean;
};

async function request<T>(
  endpoint: string,
  options: ExtendedRequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Cookies (refresh_token, csrf_token) are always included automatically
  options.credentials = 'include';

  // CSRF double-submit for state-changing requests
  try {
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
      if (match && match[1]) {
        headers.set('X-CSRF-Token', decodeURIComponent(match[1]));
      }
    }
  } catch {
    // Non-browser context guard; should not happen given 'use client'
  }

  // Bearer token from memory (never from cookie/storage)
  if (_accessToken) {
    headers.set('Authorization', `Bearer ${_accessToken}`);
  }

  options.headers = headers;

  const timeoutMs = options.timeout ?? 10 * 60 * 1000; // 10 minutes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options.signal = controller.signal;

  try {
    const response = await fetch(`${BASE_URL}/api${endpoint}`, options);

    // ── 401 recovery with single-flight refresh ───────────────────────────
    if (
      response.status === 401 &&
      !options._isRetry &&
      !AUTH_ENDPOINTS.has(endpoint)
    ) {
      // Deduplicate: at most one concurrent refresh
      if (!_refreshPromise) {
        _refreshPromise = (async () => {
          try {
            const refreshResp = await fetch(`${BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            });

            if (!refreshResp.ok) {
              throw new AuthExpiredError();
            }

            // Response is wrapped by the NestJS global ApiResponse wrapper
            const body = await refreshResp.json();
            const newToken: string = body?.data?.accessToken;
            if (!newToken) throw new AuthExpiredError();
            _accessToken = newToken;
          } catch (err) {
            _accessToken = undefined;
            _notifyAuthExpired();
            throw err;
          } finally {
            _refreshPromise = null;
          }
        })();
      }

      // All concurrent 401s wait for the shared promise
      try {
        await _refreshPromise;
      } catch {
        // Refresh failed — re-throw as AuthExpiredError so callers can handle
        throw new AuthExpiredError();
      }

      // Retry the original request exactly once with the new token
      return request<T>(endpoint, { ...options, _isRetry: true });
    }

    if (!response.ok) {
      let errorData: Record<string, any> = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }

      if (errorData.errorCode === 'QUOTA_EXCEEDED') {
        throw new QuotaError(
          errorData.message || 'Quota exceeded.',
          errorData.errorCode,
          errorData.limitType,
          errorData.used,
          errorData.limit,
          errorData.tier,
          errorData.messageAr,
        );
      }

      throw new Error(errorData.message || `API error status: ${response.status}`);
    }

    const result: ApiResponse<T> = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Action failed');
    }

    return result.data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out while waiting for AI response. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {
  get: <T>(endpoint: string, options?: ExtendedRequestInit) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, body?: any, options?: ExtendedRequestInit) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),

  patch: <T>(endpoint: string, body?: any, options?: ExtendedRequestInit) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),

  delete: <T>(endpoint: string, options?: ExtendedRequestInit) =>
    request<T>(endpoint, { method: 'DELETE', ...options }),
};
