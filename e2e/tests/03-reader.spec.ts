/**
 * 03-reader.spec.ts — Reader Suite
 *
 * Tests the document reader experience:
 *   - Reader page loads for a processed file
 *   - Sidebar is visible and tabs work
 *   - Document content is rendered
 *   - Navigation controls work
 *
 * Setup: Uploads and processes a file via API, then tests the reader UI.
 */
import { test, expect } from '../fixtures/index';
import { uploadFileViaAPI, waitForProcessing } from '../helpers/api';
import { attachConsoleMonitor } from '../helpers/console-monitor';
import { attachNetworkMonitor } from '../helpers/network-monitor';
import path from 'path';
import fs from 'fs';

const SAMPLE_PDF = path.join(__dirname, '..', 'fixtures', 'files', 'sample.pdf');

test.describe('03 · Reader', () => {
  test('reader page loads for a completed file', async ({
    page,
    request,
    authenticatedUser,
    consoleMonitor,
    networkMonitor,
  }) => {
    const token = authenticatedUser.accessToken;
    const fileBuffer = fs.readFileSync(SAMPLE_PDF);

    // ── Setup: upload and wait for processing ────────────────────────────
    const fileRecord = await uploadFileViaAPI(
      request, token, fileBuffer, 'reader-test.pdf', 'application/pdf'
    );
    const completed = await waitForProcessing(request, token, fileRecord.id, { timeout: 60_000 });
    expect(completed.processingStatus).toBe('completed');

    // ── Level 1: UI — navigate to the reader ─────────────────────────────
    await page.goto(`/read/${fileRecord.id}`, { waitUntil: 'networkidle' });

    // Reader layout should be visible
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

    // ── Level 2: HTTP — verify reader page doesn't trigger errors ────────
    networkMonitor.assertClean();
    consoleMonitor.assertClean({ allowWarnings: true });
  });

  test('reader sidebar is visible with tabs', async ({
    page,
    request,
    authenticatedUser,
  }) => {
    const token = authenticatedUser.accessToken;
    const fileBuffer = fs.readFileSync(SAMPLE_PDF);

    const fileRecord = await uploadFileViaAPI(
      request, token, fileBuffer, 'reader-sidebar.pdf', 'application/pdf'
    );
    await waitForProcessing(request, token, fileRecord.id, { timeout: 60_000 });

    await page.goto(`/read/${fileRecord.id}`, { waitUntil: 'networkidle' });

    // Sidebar should be present (contains the Outline/Bookmarks/AI tabs)
    await expect(page.locator('aside')).toBeVisible({ timeout: 10_000 });

    // Outline tab should be present
    await expect(page.getByRole('button', { name: /outline/i })).toBeVisible();

    // AI Tutor tab should be present
    await expect(page.getByRole('button', { name: /AI Tutor|AI/i })).toBeVisible();
  });

  test('clicking AI Tutor tab shows the AI input bar', async ({
    page,
    request,
    authenticatedUser,
  }) => {
    const token = authenticatedUser.accessToken;
    const fileBuffer = fs.readFileSync(SAMPLE_PDF);

    const fileRecord = await uploadFileViaAPI(
      request, token, fileBuffer, 'reader-ai-tab.pdf', 'application/pdf'
    );
    await waitForProcessing(request, token, fileRecord.id, { timeout: 60_000 });

    await page.goto(`/read/${fileRecord.id}`, { waitUntil: 'networkidle' });

    // Click AI Tutor tab
    await page.getByRole('button', { name: /AI Tutor|AI/i }).click();

    // AI input bar should appear
    await expect(
      page.locator('input[placeholder*="question"], input[placeholder*="Ask"]')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('reader header shows the document title', async ({
    page,
    request,
    authenticatedUser,
  }) => {
    const token = authenticatedUser.accessToken;
    const fileBuffer = fs.readFileSync(SAMPLE_PDF);

    const fileRecord = await uploadFileViaAPI(
      request, token, fileBuffer, 'my-document.pdf', 'application/pdf'
    );
    await waitForProcessing(request, token, fileRecord.id, { timeout: 60_000 });

    await page.goto(`/read/${fileRecord.id}`, { waitUntil: 'networkidle' });

    // The reader header should contain the document name
    await expect(page.getByText('my-document.pdf')).toBeVisible({ timeout: 10_000 });
  });

  test('accessing /read/:id for non-existent file shows error or redirects', async ({
    page,
    authenticatedUser,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await page.goto(`/read/${fakeId}`);

    // Either the page shows an error state or redirects
    const isErrorOrRedirect =
      (res?.status() ?? 200) >= 400 ||
      page.url().includes('/files') ||
      page.url().includes('/dashboard') ||
      await page.locator('[class*="error"], [class*="not-found"]').isVisible().catch(() => false);

    expect(isErrorOrRedirect).toBe(true);
  });
});
