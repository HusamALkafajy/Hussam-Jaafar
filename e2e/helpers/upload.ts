/**
 * Upload helpers — browser-level file upload via the UI modal.
 *
 * Mirrors the exact chunked upload flow implemented in files/page.tsx.
 * All waits are synchronised to network requests and DOM state changes —
 * never to fixed timeouts.
 */
import { type Page, expect } from '@playwright/test';
import path from 'path';

/**
 * Opens the upload modal, attaches a file, submits, and waits for the
 * browser to navigate to the file detail page.
 *
 * Returns the new file ID extracted from the URL.
 */
export async function uploadFileViaUI(
  page: Page,
  filePath: string,
  options: { subjectId?: string } = {}
): Promise<string> {
  // Navigate to /files if not already there
  if (!page.url().includes('/files')) {
    await page.goto('/files', { waitUntil: 'networkidle' });
  }

  // Open upload modal by clicking the Upload button
  await page.getByRole('button', { name: /upload/i }).first().click();

  // Wait for modal to appear
  await expect(page.locator('[data-testid="upload-modal"], .fixed.inset-0')).toBeVisible();

  // Optionally select a subject
  if (options.subjectId) {
    await page.locator('select').filter({ hasText: /subject/i }).selectOption(options.subjectId);
  }

  // Attach file via the hidden file input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);

  // Verify file name appears in the dropzone
  const fileName = path.basename(filePath);
  await expect(page.getByText(fileName)).toBeVisible();

  // Click submit — wait for the chunk upload network requests to complete
  const [uploadResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/api/files/upload/chunk') && res.status() === 201,
      { timeout: 30_000 }
    ),
    page.getByRole('button', { name: /start upload|upload/i }).last().click(),
  ]);

  // Wait for navigation to the file detail page
  await page.waitForURL(/\/files\/[a-z0-9-]+$/, { timeout: 30_000 });

  // Extract file ID from URL
  const url = page.url();
  const fileId = url.split('/files/')[1]?.split('?')[0];
  if (!fileId) throw new Error(`Could not extract file ID from URL: ${url}`);

  return fileId;
}

/**
 * Waits for the processing status badge on the file list or detail page
 * to transition to 'completed'. Synchronises to DOM state changes.
 */
export async function waitForProcessingUI(page: Page, options: { timeout?: number } = {}): Promise<void> {
  const timeout = options.timeout ?? 60_000;

  // Wait for the badge to show "Completed" (or localized equivalent)
  // The backend sets processingStatus = 'completed' and the UI polls every 3s
  await expect(
    page.locator('[data-testid="processing-status"], .badge, [class*="badge"]').filter({
      hasText: /completed|complete/i,
    })
  ).toBeVisible({ timeout });
}

/**
 * Verifies the file appears in the files list on /files.
 */
export async function verifyFileInList(page: Page, fileName: string): Promise<void> {
  await page.goto('/files', { waitUntil: 'networkidle' });
  await expect(page.getByText(fileName)).toBeVisible({ timeout: 10_000 });
}
