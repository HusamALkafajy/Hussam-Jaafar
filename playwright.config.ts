import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * StudyAI Release Certification Suite
 * Official Playwright configuration for production certification.
 * Run: pnpm test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Zero flake tolerance — no retries on CI
  retries: process.env.CI ? 0 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-results/html-report', open: 'never' }],
    ['json', { outputFile: 'e2e-results/results.json' }],
    ['./e2e/reporter/certification-reporter.ts'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    // Never use fixed waits — synchronize on network/DOM
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    // Observability: capture everything on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // Network monitoring
    extraHTTPHeaders: {
      'x-e2e-test': 'true',
    },
  },

  outputDir: 'e2e-results/artifacts',

  projects: [
    // Setup project — runs first to create shared auth state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // --- Chromium (Primary) ---
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // No stored auth state — every test creates its own user
      },
      testIgnore: /.*\.setup\.ts/,
    },

    // --- Firefox ---
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
      testIgnore: /.*\.setup\.ts/,
      // Run Firefox only on core journey + smoke for speed
      testMatch: /e2e\/tests\/(00-smoke|01-auth|05-core-journey)\..*/,
    },

    // --- WebKit ---
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
      testIgnore: /.*\.setup\.ts/,
      testMatch: /e2e\/tests\/(00-smoke|01-auth|05-core-journey)\..*/,
    },
  ],

  // No webServer block — the dev server is expected to be running externally
  // Start with: pnpm dev (in a separate terminal)
  // Or: pnpm test:e2e will handle starting/stopping via globalSetup
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
});
