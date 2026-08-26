/**
 * 02-upload.spec.ts — File Upload Suite
 *
 * Tests the complete file upload pipeline:
 *   - PDF upload (UI + API + DB verification)
 *   - Chunked upload protocol
 *   - Processing status polling
 *   - File appears in list after completion
 *
 * Isolation: Each test creates its own user and uploads its own file.
 * The randomized storage key in the backend prevents any filename collision.
 */
import { test, expect } from '../fixtures/index';
import { uploadFileViaAPI, waitForProcessing, listFiles } from '../helpers/api';
import path from 'path';

const SAMPLE_PDF = path.join(__dirname, '..', 'fixtures', 'files', 'sample.pdf');

test.describe('02 · File Upload', () => {
  test('upload PDF via API — 3-level validation', async ({
    request,
    authenticatedUser,
    consoleMonitor,
    networkMonitor,
  }) => {
    const token = authenticatedUser.accessToken;
    const fileBuffer = require('fs').readFileSync(SAMPLE_PDF);

    // ── Level 2: HTTP — upload succeeds ──────────────────────────────────
    const fileRecord = await uploadFileViaAPI(
      request,
      token,
      fileBuffer,
      'sample.pdf',
      'application/pdf'
    );

    expect(fileRecord.id).toBeTruthy();
    expect(fileRecord.originalName).toBe('sample.pdf');
    expect(fileRecord.mimeType).toBe('application/pdf');
    expect(['pending', 'processing', 'completed']).toContain(fileRecord.processingStatus);

    // ── Level 3: DB — file persists and processing completes ─────────────
    const completed = await waitForProcessing(request, token, fileRecord.id, {
      timeout: 60_000,
    });

    expect(completed.processingStatus).toBe('completed');
    expect(completed.extractedText).toBeTruthy();

    // ── Level 3: DB — file appears in list ───────────────────────────────
    const files = await listFiles(request, token);
    const found = files.find((f) => f.id === fileRecord.id);
    expect(found).toBeDefined();
    expect(found!.processingStatus).toBe('completed');

    networkMonitor.assertClean();
  });

  test('upload PDF via UI — navigates to file detail page', async ({
    page,
    authenticatedUser,
  }) => {
    // Navigate to files page
    await page.goto('/files', { waitUntil: 'networkidle' });

    // Open upload modal
    await page.getByRole('button', { name: /upload/i }).first().click();

    // Wait for modal
    await expect(page.locator('.fixed.inset-0, [role="dialog"]')).toBeVisible({ timeout: 5_000 });

    // Attach file
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);

    // Verify filename appears
    await expect(page.getByText('sample.pdf')).toBeVisible();

    // Submit and wait for redirect to file detail
    const uploadResponse = page.waitForResponse(
      (res) => res.url().includes('/upload/chunk') && res.status() === 201,
      { timeout: 30_000 }
    );

    await page.getByRole('button', { name: /start upload|upload/i }).last().click();

    await uploadResponse;

    // Wait for redirect to file detail page
    await page.waitForURL(/\/files\/[a-z0-9-]+$/, { timeout: 30_000 });

    // Verify we're on the file detail/reader page
    const url = page.url();
    expect(url).toMatch(/\/files\/[a-z0-9-]+$/);
  });

  test('file list shows uploaded file with processing badge', async ({
    page,
    request,
    authenticatedUser,
  }) => {
    const token = authenticatedUser.accessToken;
    const fileBuffer = require('fs').readFileSync(SAMPLE_PDF);

    // Upload via API (faster than UI for setup)
    const fileRecord = await uploadFileViaAPI(
      request,
      token,
      fileBuffer,
      'test-list-file.pdf',
      'application/pdf'
    );

    // Navigate to files list
    await page.goto('/files', { waitUntil: 'networkidle' });

    // Wait for file to appear in the list
    await expect(page.getByText('test-list-file.pdf')).toBeVisible({ timeout: 15_000 });

    // Verify a status badge is present (pending/processing/completed)
    const card = page.getByText('test-list-file.pdf').locator('..').locator('..');
    await expect(card.locator('[class*="badge"], .badge').first()).toBeVisible();
  });

  test('deleting a file removes it from the list', async ({
    page,
    request,
    authenticatedUser,
  }) => {
    const token = authenticatedUser.accessToken;
    const fileBuffer = require('fs').readFileSync(SAMPLE_PDF);

    // Upload via API
    const fileRecord = await uploadFileViaAPI(
      request,
      token,
      fileBuffer,
      'to-delete.pdf',
      'application/pdf'
    );

    // Navigate to files list
    await page.goto('/files', { waitUntil: 'networkidle' });
    await expect(page.getByText('to-delete.pdf')).toBeVisible({ timeout: 15_000 });

    // Delete via API directly (UI uses confirm() dialog which is hard to automate)
    const deleteRes = await request.delete(
      `${process.env.E2E_API_URL || 'http://localhost:4000'}/api/files/${fileRecord.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect([200, 204]).toContain(deleteRes.status());

    // Refresh and verify file is gone
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('to-delete.pdf')).not.toBeVisible({ timeout: 10_000 });
  });
});
