/**
 * performance/11-performance.spec.ts — Performance Suite
 *
 * Runs strictly against performance budgets defined in the Release Quality Gate.
 *   - LCP (Largest Contentful Paint)
 *   - Navigation times
 */
import { test, expect } from '../../fixtures/index';
import { assertPageLoadBudget, collectWebVitals } from '../../helpers/performance';

test.describe('11 · Performance', () => {
  test('login page loads within budget and meets Web Vitals', async ({ page }) => {
    // Assert page navigation time
    await assertPageLoadBudget(page, '/login');

    // Collect Web Vitals
    const vitals = await collectWebVitals(page);
    
    // LCP should be under 2.5s (2500ms) for good user experience
    if (vitals.LCP) {
      expect(vitals.LCP).toBeLessThan(2500);
    }
  });

  test('dashboard loads within budget for authenticated user', async ({
    page,
    authenticatedUser,
  }) => {
    // We start on the dashboard because of the fixture
    // Let's measure a hard reload
    const start = Date.now();
    await page.reload({ waitUntil: 'networkidle' });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // 5s budget for dashboard load
  });
});
