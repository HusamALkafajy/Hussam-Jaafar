/**
 * Authentication helpers for the E2E certification suite.
 *
 * Every test provisions its own unique user. There is no shared auth state.
 * This guarantees row-level isolation in PostgreSQL by ensuring all
 * child entities (files, subjects) are bound to a unique userId.
 */
import { type Page, type APIRequestContext, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accessToken: string;
}

// eslint-disable-next-line no-restricted-syntax
const API_BASE = process.env.E2E_API_URL || 'http://localhost:4000';

/**
 * Creates a unique test user via the API and returns full credentials.
 * Uses a UUID suffix to guarantee no email collisions in PostgreSQL.
 */
export async function createTestUser(request: APIRequestContext): Promise<TestUser> {
  const uid = randomUUID().replace(/-/g, '').slice(0, 12);
  const generatedPassword = `E2E-${uid}-${randomUUID()}-A1!`;
  const user = {
    email: `e2e-${uid}@test-studyai.local`,
    password: generatedPassword,
    firstName: 'E2E',
    lastName: `User-${uid}`,
  };

  const registerRes = await request.post(`${API_BASE}/api/auth/register`, {
    data: user,
  });

  if (!registerRes.ok()) {
    const body = await registerRes.text();
    throw new Error(`Failed to register test user: ${registerRes.status()} — ${body}`);
  }

  const body = await registerRes.json();
  const tokenPayload = body.data || body;
  const accessToken = tokenPayload.accessToken || tokenPayload.access_token || tokenPayload.token;

  if (!accessToken) {
    throw new Error(`Register response missing accessToken. Got: ${JSON.stringify(body)}`);
  }

  return {
    id: tokenPayload.user?.id || tokenPayload.id,
    email: user.email,
    password: user.password,
    firstName: user.firstName,
    lastName: user.lastName,
    accessToken,
  };
}

/**
 * Logs in an existing user via the API. Returns a fresh access token.
 */
export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Login failed: ${res.status()} — ${body}`);
  }

  const body = await res.json();
  const tokenPayload = body.data || body;
  const token = tokenPayload.accessToken || tokenPayload.access_token || tokenPayload.token;
  if (!token) throw new Error(`Login response missing token. Got: ${JSON.stringify(body)}`);
  return token;
}

/**
 * Sets auth cookie/storage on the given page so it acts as an authenticated user.
 * Navigates to /login, submits the form, and waits for the files redirect.
 *
 * This is the "full browser login" path — validates the real login flow.
 */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForURL('**/login', { waitUntil: 'domcontentloaded' });

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);

  await Promise.all([
    page.waitForURL('**/files', { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

/**
 * Fast auth via API — transfers the HttpOnly authentication cookies from the
 * Playwright API context into the browser context. This allows the web app
 * to hydrate the session naturally via /api/auth/refresh on page load.
 */
export async function loginViaToken(page: Page, request: APIRequestContext): Promise<void> {
  // Transfer the cookies (refresh_token, csrf_token) obtained during user creation
  // from the isolated API context into the browser context.
  const state = await request.storageState();
  await page.context().addCookies(state.cookies);

  // Navigate to the protected app to activate the authenticated session
  await page.goto('/files', { waitUntil: 'networkidle' });
}

/**
 * Verifies the user is logged out by checking they cannot access /files.
 */
export async function verifyLoggedOut(page: Page): Promise<void> {
  await page.goto('/files');
  // Should redirect to /login
  await expect(page).toHaveURL(/\/(login|\/)?$/, { timeout: 10_000 });
}
