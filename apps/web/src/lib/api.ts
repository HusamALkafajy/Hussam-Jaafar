import { ApiResponse, ErrorResponse } from '@studyai/types';

const BASE_URL = typeof window === 'undefined'
  ? (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000')
  : '';

/**
 * API Endpoints Contract Map:
 * 
 * Student Analytics:
 * - GET   /analytics/overview  -> Returns OverviewStats
 * - GET   /analytics/activity  -> Returns ActivityLog[]
 * 
 * Administrative Panel:
 * - GET   /admin/stats          -> Returns AdminStats
 * - GET   /admin/activity-logs  -> Returns ActivityLog[]
 * - GET   /admin/users          -> Returns UserItem[]
 * - PATCH /admin/users/:id      -> Updates user details (role, isActive)
 * - GET   /admin/payments       -> Returns PaymentItem[]
 * - GET   /admin/ai-usage/stats -> Returns AIUsageStats
 * - GET   /admin/ai-usage/logs  -> Returns AICallLog[]
 */

type ExtendedRequestInit = RequestInit & {
  timeout?: number;
};

async function request<T>(
  endpoint: string,
  options: ExtendedRequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Ensure cookies are sent (HttpOnly tokens)
  options.credentials = 'include';
  const timeoutMs = options.timeout ?? 10 * 60 * 1000; // 10 minutes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options.signal = controller.signal;

  // Attach access_token globally as Bearer token in the Authorization header
  let accessToken: string | undefined;

  if (typeof window === 'undefined') {
    // Server-side: retrieve from request cookies
    try {
      const { cookies } = require('next/headers');
      const cookieStore = await cookies();

      // Also forward all cookies for session and refresh support
      const allCookies = cookieStore.getAll().map((c: any) => `${c.name}=${c.value}`).join('; ');
      if (allCookies) {
        headers.set('Cookie', allCookies);
      }
    } catch (e) {
      console.warn('Failed to forward cookies on server-side request:', e);
    }
  } else {
    // Client-side: do NOT read `access_token` from document.cookie (httpOnly).
    // Browser will include cookies when `credentials: 'include'` is set.
    // For state-changing requests, include the CSRF token from the readable cookie.
    try {
      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
        if (match && match[1]) {
          headers.set('X-CSRF-Token', decodeURIComponent(match[1]));
        }
      }
    } catch (e) {
      // Non-blocking: if cookies aren't available, the request will proceed and server-side CSRF check may fail.
      // We avoid logging sensitive cookie contents.
    }
  }

  // Do not populate Authorization header from cookie on the client to avoid exposing tokens.

  options.headers = headers;

  try {
    const response = await fetch(`${BASE_URL}/api${endpoint}`, options);

    if (!response.ok) {
      let errorData: Partial<ErrorResponse> = {};
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
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

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),

  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: 'DELETE', ...options }),
};
