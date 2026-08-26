'use client';

/**
 * Backward-compat re-export.
 * All client component imports of '../lib/api' continue to resolve here.
 * The actual implementation lives in api-client.ts.
 *
 * Server Components, middleware, and route handlers MUST NOT import this file.
 */
export { api, setAccessToken, onAuthExpired, QuotaError, AuthExpiredError } from './api-client';
