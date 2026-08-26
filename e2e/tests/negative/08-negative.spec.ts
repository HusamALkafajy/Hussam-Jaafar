/**
 * negative/08-negative.spec.ts — Negative Test Suite
 *
 * Tests failure scenarios to verify correct error handling:
 *   - Wrong credentials
 *   - Unsupported file types
 *   - Missing required fields
 *   - Non-existent resource access
 *   - Malformed requests
 */
import { test, expect } from '../../fixtures/index';
import { createTestUser } from '../../helpers/auth';
import path from 'path';
import fs from 'fs';

const UNSUPPORTED_TXT = path.join(__dirname, '..', '..', 'fixtures', 'files', 'unsupported.txt');
// eslint-disable-next-line no-restricted-syntax
const API_BASE = process.env.E2E_API_URL || 'http://localhost:4000';

test.describe('08 · Negative — Error Handling', () => {
  test('UI: wrong credentials shows error message', async ({ page, request }) => {
    const user = await createTestUser(request);
    const wrongPassword = `Wrong-${Date.now()}-A1!`;

    await page.goto('/login');
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill(wrongPassword);
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should remain on login page
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    // Error indicator should be visible
    await expect(
      page.locator('[class*="rose"], [class*="error"], [class*="danger"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('UI: registering with mismatched passwords shows error', async ({ page }) => {
    const mismatchPassword = `Mismatch-${Date.now()}-A1!`;
    const differentPassword = `Different-${Date.now()}-B2!`;

    await page.goto('/register');
    await page.locator('#firstName').fill('Test');
    await page.locator('#lastName').fill('User');
    await page.locator('#email').fill(`mismatch-${Date.now()}@test.local`);
    await page.locator('#password').fill(mismatchPassword);
    await page.locator('#confirmPassword').fill(differentPassword);
    await page.getByRole('button', { name: /register|sign up/i }).click();

    // Should show a mismatch error
    await expect(
      page.getByText(/passwords do not match|mismatch/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('API: uploading .txt file returns 400 Bad Request', async ({
    request,
    authenticatedUser,
  }) => {
    const fileBuffer = fs.readFileSync(UNSUPPORTED_TXT);
    const token = authenticatedUser.accessToken;

    const res = await request.post(`${API_BASE}/api/files/upload/chunk`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        uploadId: `neg-txt-${Date.now()}`,
        chunkIndex: '0',
        totalChunks: '1',
        filename: 'test.txt',
        file: { name: 'test.txt', mimeType: 'text/plain', buffer: fileBuffer },
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message || body.error).toBeTruthy();
  });

  test('API: accessing non-existent file returns 404', async ({
    request,
    authenticatedUser,
  }) => {
    const fakeId = '11111111-1111-1111-1111-111111111111';
    const res = await request.get(`${API_BASE}/api/files/${fakeId}`, {
      headers: { Authorization: `Bearer ${authenticatedUser.accessToken}` },
    });
    expect(res.status()).toBe(404);
  });

  test('API: register with duplicate email returns 409 or 400', async ({
    request,
    authenticatedUser,
  }) => {
    // Try to register with an already-existing email
    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: authenticatedUser.email, // already exists
        password: authenticatedUser.password,
        firstName: 'Dupe',
        lastName: 'User',
      },
    });
    // Conflict or validation error
    expect([400, 409, 422]).toContain(res.status());
  });

  test('API: missing required fields in register returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: { email: `missing-fields-${Date.now()}@test.local` }, // missing password
    });
    expect(res.status()).toBe(400);
  });

  test('UI: upload modal closes on X button', async ({
    page,
    authenticatedUser,
  }) => {
    await page.goto('/files', { waitUntil: 'networkidle' });

    // Open upload modal
    await page.getByRole('button', { name: /upload/i }).first().click();
    await expect(page.locator('.fixed.inset-0')).toBeVisible({ timeout: 5_000 });

    // Click X to close
    await page.locator('.fixed.inset-0').locator('button').filter({ hasText: '' }).last().click();

    // Modal should be gone
    await expect(page.locator('.fixed.inset-0')).not.toBeVisible({ timeout: 5_000 });
  });
});
