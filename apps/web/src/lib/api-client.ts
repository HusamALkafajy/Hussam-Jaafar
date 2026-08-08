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
 * Structured error containing HTTP status code for UI error mapping.
 */
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'response';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly kind: ApiErrorKind = 'http',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const safeHttpErrorMessage = (status: number): string => {
  if (status === 400) return 'Request validation failed.';
  if (status === 401) return 'Authentication required.';
  if (status === 403) return 'Request forbidden.';
  if (status === 404) return 'Requested resource not found.';
  if (status === 409) return 'Request conflict.';
  if (status === 429) return 'Too many requests.';
  if (status >= 500) return 'Server request failed.';
  return `Request failed with status ${status}.`;
};

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

export const getAccessToken = (): string | undefined => {
  return _accessToken;
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

  const timeoutMs = options.timeout ?? 10 * 60 * 1000; // 10 minutes
  const callerSignal = options.signal;
  const isRetry = options._isRetry;
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const requestOptions: ExtendedRequestInit = {
    ...options,
    credentials: 'include',
    headers,
    signal: controller.signal,
  };
  delete requestOptions.timeout;
  delete requestOptions._isRetry;

  try {
    const response = await fetch(`${BASE_URL}/api${endpoint}`, requestOptions);

    // ── 401 recovery with single-flight refresh ───────────────────────────
    if (
      response.status === 401 &&
      !isRetry &&
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
        // Never expose raw text or HTML error bodies to callers.
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

      throw new ApiError(safeHttpErrorMessage(response.status), response.status);
    }

    if (response.status === 204) return undefined as T;

    let result: ApiResponse<T>;
    try {
      result = await response.json();
    } catch {
      throw new ApiError('Invalid server response.', response.status, 'response');
    }

    if (!result.success) {
      throw new ApiError('Action failed.', response.status, 'response');
    }

    return result.data;
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      if (timedOut) {
        throw new ApiError('Request timed out.', 504, 'timeout');
      }
      throw new ApiError('Request was cancelled.', 0, 'aborted');
    }
    if (error instanceof ApiError || error instanceof QuotaError || error instanceof AuthExpiredError) {
      throw error;
    }
    throw new ApiError('Network request failed.', 0, 'network');
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
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
