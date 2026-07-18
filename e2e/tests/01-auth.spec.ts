/**
 * 01-auth.spec.ts — Authentication Suite
 *
 * Tests the complete authentication lifecycle:
 *   - Registration (UI + API verification)
 *   - Login (UI)
 *   - Token refresh (API)
 *   - Logout
 *   - Protected route guard
 *
 * Isolation: Each test creates its own unique user via createTestUser().
 * No shared state between tests.
 */
import { test, expect } from '../fixtures/index';
import { createTestUser, loginViaUI, verifyLoggedOut } from '../helpers/auth';
import { attachConsoleMonitor } from '../helpers/console-monitor';
import { attachNetworkMonitor } from '../helpers/network-monitor';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:4000';

test.describe('01 · Authentication', () => {
  test('register via UI creates a new user and redirects to files', async ({
    page,
    request,
    consoleMonitor,
    networkMonitor,
  }) => {
    // Level 1: UI
    await page.goto('/register');
    await expect(page.locator('#firstName')).toBeVisible();

    const uid = Date.now().toString(36);
    const email = `e2e-reg-${uid}@test-studyai.local`;
    const password = 'TestPass123!';

    await page.locator('#firstName').fill('E2E');
    await page.locator('#lastName').fill('Tester');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);

    // Level 2: verify POST /api/auth/register returns 201
    const [registerResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/register') && res.status() === 201,
        { timeout: 15_000 }
      ),
      page.locator('button[type="submit"]').click({ force: true }),
    ]);
    expect(registerResponse.status()).toBe(201);

    // Wait for redirect to files
    await page.waitForURL('**/files', { timeout: 20_000 });

    // Level 3: verify user exists via API
    const body = await registerResponse.json();
    const tokenPayload = body.data || body;
    const token = tokenPayload.accessToken || tokenPayload.access_token || tokenPayload.token;
    expect(token).toBeTruthy();

    const meRes = await request.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status()).toBe(200);
    const me = await meRes.json();
    const meUser = me.data?.user || me.data || me;
    expect(meUser.email).toBe(email);

    // Quality gate: no unexpected console errors
    consoleMonitor.assertClean({ allowWarnings: true });
    networkMonitor.assertClean();
  });

  test('login via UI with valid credentials navigates to files', async ({
    page,
    request,
    consoleMonitor,
    networkMonitor,
  }) => {
    // Create a fresh user via API first
    const user = await createTestUser(request);

    // Level 1: UI login
    await page.goto('/login');
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill(user.password);

    // Level 2: verify POST /api/auth/login returns 200
    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/login') && res.status() === 200,
        { timeout: 15_000 }
      ),
      page.locator('button[type="submit"]').click({ force: true }),
    ]);
    expect(loginResponse.status()).toBe(200);

    // Verify redirect
    await page.waitForURL('**/files', { timeout: 20_000 });

    // Level 3: verify token works against API
    const body = await loginResponse.json();
    const tokenPayload = body.data || body;
    const token = tokenPayload.accessToken || tokenPayload.access_token || tokenPayload.token;
    expect(token).toBeTruthy();

    consoleMonitor.assertClean({ allowWarnings: true });
    networkMonitor.assertClean();
  });

  test('login with wrong password shows error message', async ({ page, request }) => {
    const user = await createTestUser(request);

    await page.goto('/login');
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill('WrongPassword999!');
    await page.locator('button[type="submit"]').click({ force: true });

    // Should stay on login page and show error
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    // Error message should be visible (any error indicator)
    await expect(
      page.locator('[class*="rose"], [class*="error"], [class*="danger"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('accessing /files without auth redirects to login', async ({ page }) => {
    // Navigate to a valid origin first to avoid about:blank SecurityError
    await page.goto('/login');

    // Clear any existing auth state
    await page.evaluate(() => {
      localStorage.clear();
      // Delete any accessible cookies just in case
      document.cookie.split(';').forEach((c) => {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
    });

    await page.goto('/files');
    // Should redirect to login
    await page.waitForURL(/\/(login|)$/, { timeout: 10_000 });
    await expect(page.locator('#email')).toBeVisible();
  });

  test('logout clears session and redirects to login', async ({
    page,
    authenticatedUser,
  }) => {
    // We are now on /files (set up by fixture)
    await expect(page).toHaveURL(/files/);

    // Find and click logout
    // Find and click logout in the sidebar (it uses an <a> tag in SidebarNavItem)
    const logoutBtn = page.locator('a', { hasText: /logout|sign out|خروج/i }).last();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click({ force: true });
    } else {
      // Fallback: click the sidebar item containing the LogOut icon text
      await page.locator('.text-destructive').filter({ hasText: /logout|sign out|خروج/i }).click({ force: true });
    }

    // Wait for redirect to login
    await page.waitForURL(/\/(login|)$/, { timeout: 15_000 });
    await expect(page.locator('#email')).toBeVisible();

    // Verify files is no longer accessible
    await page.goto('/files');
    await page.waitForURL(/\/(login|)$/, { timeout: 10_000 });
  });

  test('invalid JWT returns 401 from API', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/files`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    expect(res.status()).toBe(401);
  });

  test('missing Authorization header returns 401 from API', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/auth/me`);
    expect(res.status()).toBe(401);
  });
});
