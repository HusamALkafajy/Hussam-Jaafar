/**
 * 00-smoke.spec.ts — Smoke Test Suite
 *
 * Validates that all required application pages and APIs are reachable.
 * This is the first gate in the certification pipeline.
 * If smoke fails, all other suites are meaningless.
 *
 * Isolation: Does NOT require authentication. Pure connectivity checks.
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:4000';

test.describe('00 · Smoke — Environment Connectivity', () => {
  test('API health endpoint responds 200', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health`);
    expect(res.status()).toBe(200);
  });

  test('Web: login page is reachable and renders form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('Web: register page is reachable and renders form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('#firstName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('Web: marketing/home page renders', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(400);
  });

  test('API: unauthenticated request to /api/files returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/files`);
    expect(res.status()).toBe(401);
  });

  test('API: unauthenticated request to /api/auth/me returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/auth/me`);
    expect(res.status()).toBe(401);
  });
});
