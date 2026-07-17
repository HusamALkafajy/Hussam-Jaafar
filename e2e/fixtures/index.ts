/**
 * Shared test fixtures for the StudyAI E2E certification suite.
 *
 * Extends the base Playwright test with:
 *   - authenticatedUser: a unique API-provisioned user + browser session
 *   - consoleMonitor: collects console messages for quality gate
 *   - networkMonitor: tracks HTTP failures for quality gate
 *
 * Every test that uses these fixtures gets complete isolation:
 *   - Unique PostgreSQL user row (different userId)
 *   - Separate JWT tokens
 *   - No shared file or subject state
 */
import { test as base, expect } from '@playwright/test';
import { createTestUser, loginViaToken, type TestUser } from '../helpers/auth';
import { ConsoleMonitor, attachConsoleMonitor } from '../helpers/console-monitor';
import { NetworkMonitor, attachNetworkMonitor } from '../helpers/network-monitor';

export interface AuthenticatedFixtures {
  /** Unique test user with API access token, injected into the browser session */
  authenticatedUser: TestUser;
  /** Console monitor — call assertClean() in afterEach */
  consoleMonitor: ConsoleMonitor;
  /** Network monitor — call assertClean() in afterEach */
  networkMonitor: NetworkMonitor;
}

export const test = base.extend<AuthenticatedFixtures>({
  /**
   * Provisions a unique user via the API, injects the token into the browser,
   * and navigates to /dashboard. Runs for every test independently.
   */
  authenticatedUser: async ({ page, request }, use) => {
    const user = await createTestUser(request);
    await loginViaToken(page, user.accessToken);
    await use(user);
    // No teardown needed — DB records belong to the unique userId
    // and are isolated from all other tests
  },

  /**
   * Attaches a console monitor to capture all browser log messages.
   */
  consoleMonitor: async ({ page }, use) => {
    const monitor = attachConsoleMonitor(page);
    await use(monitor);
    // Quality gate: assert no unexpected errors after each test
    // (Called in individual tests when strict validation is needed)
  },

  /**
   * Attaches a network monitor to capture all HTTP responses.
   */
  networkMonitor: async ({ page }, use) => {
    const monitor = attachNetworkMonitor(page);
    await use(monitor);
  },
});

export { expect };
