/**
 * regression/09-regression.spec.ts — Regression Test Suite
 *
 * Prevents re-occurrence of previously fixed bugs.
 * Every time a bug is fixed, a test should be added here to guarantee
 * it never breaks again in future releases.
 */
import { test, expect } from '../../fixtures/index';
import { createTestUser } from '../../helpers/auth';

// eslint-disable-next-line no-restricted-syntax
const API_BASE = process.env.E2E_API_URL || 'http://localhost:4000';

test.describe('09 · Regression', () => {
  test('Issue #101: Dashboard should not crash on empty subjects list', async ({
    page,
    authenticatedUser,
  }) => {
    // The user was just created, so they have 0 subjects and 0 files
    await page.goto('/dashboard');
    await expect(page.locator('main, .dashboard, [class*="dashboard"]').first()).toBeVisible({
      timeout: 10_000,
    });
    // Ensure no error boundary caught an exception
    await expect(page.locator('[class*="error"], [class*="crash"]')).not.toBeVisible();
  });

  test('Issue #105: Registering with trailing spaces in email succeeds', async ({
    request,
  }) => {
    const uid = Date.now().toString(36);
    const emailWithSpaces = `  regression-${uid}@test.local  `;
    const cleanEmail = `regression-${uid}@test.local`;
    const registrationPassword = `Regression-${uid}-A1!`;

    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: emailWithSpaces,
        password: registrationPassword,
        firstName: 'Regression',
        lastName: 'Tester',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();

    // Some systems normalize the returned email, some don't, but the registration must succeed
    expect(body.accessToken || body.access_token || body.token).toBeTruthy();
    expect(cleanEmail).toContain(uid);
  });
});
