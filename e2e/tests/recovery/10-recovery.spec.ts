/**
 * recovery/10-recovery.spec.ts — Recovery Suite
 *
 * Tests that the system can gracefully recover from unexpected interruptions.
 * This suite MUST run in serial because it intentionally disrupts the browser context.
 */
import { test, expect } from '../../fixtures/index';

// We run this file in serial mode
test.describe.configure({ mode: 'serial' });

test.describe('10 · Recovery', () => {
  test('session is preserved after page reload', async ({
    page,
    authenticatedUser,
  }) => {
    // Navigate to dashboard and verify auth state
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.locator('main, .dashboard').first()).toBeVisible();

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });

    // Ensure we are still on the dashboard and not redirected to login
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('main, .dashboard').first()).toBeVisible();
  });

  test('navigating back and forth maintains state', async ({
    page,
    authenticatedUser,
  }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    // Navigate to files
    await page.goto('/files', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/files/);
    
    // Go back
    await page.goBack({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/dashboard/);
    
    // Go forward
    await page.goForward({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/files/);
  });
});
