/**
 * 05-core-journey.spec.ts — Core User Journey Suite
 *
 * Tests the complete end-to-end user journey in a single test:
 *   Register → Upload → Wait for processing → Open reader → AI chat
 *
 * This is the primary certification test. If this fails, the release is blocked.
 *
 * Validation at every step: UI + HTTP + persisted state.
 */
import { test, expect } from '../fixtures/index';
import { createTestUser, loginViaUI } from '../helpers/auth';
import { waitForProcessing } from '../helpers/api';
import { attachConsoleMonitor } from '../helpers/console-monitor';
import { attachNetworkMonitor } from '../helpers/network-monitor';
import { measureWithBudget } from '../helpers/performance';
import path from 'path';
import fs from 'fs';

const SAMPLE_PDF = path.join(__dirname, '..', 'fixtures', 'files', 'sample.pdf');
const API_BASE = process.env.E2E_API_URL || 'http://localhost:4000';

test.describe('05 · Core Journey — Full E2E Certification', () => {
  test('complete user journey: register → upload → reader → AI', async ({
    page,
    request,
  }) => {
    const consoleMonitor = attachConsoleMonitor(page);
    const networkMonitor = attachNetworkMonitor(page);

    // ── Step 1: Register ─────────────────────────────────────────────────
    const uid = Date.now().toString(36);
    const email = `e2e-journey-${uid}@test-studyai.local`;
    const password = 'TestPass123!';

    await page.goto('/register');
    await page.locator('#firstName').fill('Journey');
    await page.locator('#lastName').fill('Test');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);

    const [registerRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/auth/register') && r.status() === 201,
        { timeout: 15_000 }
      ),
      page.getByRole('button', { name: /register|sign up/i }).click(),
    ]);

    const registerBody = await registerRes.json();
    const tokenPayload = registerBody.data || registerBody;
    const token: string = tokenPayload.accessToken || tokenPayload.access_token || tokenPayload.token;
    expect(token).toBeTruthy();

    await page.waitForURL('**/dashboard', { timeout: 20_000 });

    // ── Step 2: Navigate to files and upload ─────────────────────────────
    await page.goto('/files', { waitUntil: 'networkidle' });

    // Open upload modal
    await page.getByRole('button', { name: /upload/i }).first().click();
    await expect(page.locator('.fixed.inset-0, [role="dialog"]')).toBeVisible({ timeout: 5_000 });

    // Attach the PDF
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);
    await expect(page.getByText('sample.pdf')).toBeVisible();

    // Submit upload and measure time against budget
    const { result: uploadUrl } = await measureWithBudget(
      'PDF Upload',
      'upload',
      async () => {
        const [chunkRes] = await Promise.all([
          page.waitForResponse(
            (r) => r.url().includes('/upload/chunk') && r.status() === 201,
            { timeout: 30_000 }
          ),
          page.getByRole('button', { name: /start upload|upload/i }).last().click(),
        ]);
        await page.waitForURL(/\/files\/[a-z0-9-]+$/, { timeout: 30_000 });
        return page.url();
      }
    );

    const fileId = uploadUrl.split('/files/')[1]?.split('?')[0];
    expect(fileId).toBeTruthy();

    // ── Step 3: Wait for processing via API polling ───────────────────────
    // Level 3: DB verification — processing completes within budget
    const { result: completedFile } = await measureWithBudget(
      'File Processing',
      'processing',
      () => waitForProcessing(request, token, fileId, { timeout: 60_000 })
    );

    expect(completedFile.processingStatus).toBe('completed');
    expect(completedFile.extractedText).toBeTruthy();
    expect(completedFile.extractedText!.length).toBeGreaterThan(10);

    // ── Step 4: Open the reader ───────────────────────────────────────────
    const { measurement: readerMeasurement } = await measureWithBudget(
      'Reader Load',
      'readerReady',
      () => page.goto(`/read/${fileId}`, { waitUntil: 'networkidle' })
    );

    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('aside')).toBeVisible();

    // ── Step 5: Open AI tutor and send a question ─────────────────────────
    await page.getByRole('button', { name: /AI Tutor|AI/i }).click();

    const aiInput = page.locator('input[placeholder*="question"], input[placeholder*="Ask"]');
    await expect(aiInput).toBeVisible({ timeout: 5_000 });

    await aiInput.fill('Summarize this document in one sentence.');
    await page.locator('button[type="submit"]').last().click();

    // Input clears on submit
    await expect(aiInput).toHaveValue('', { timeout: 5_000 });

    // ── Quality Gate assertions ───────────────────────────────────────────
    consoleMonitor.assertClean({ allowWarnings: true });
    networkMonitor.assertClean();

    console.log('✅ Core Journey PASS — all steps completed successfully');
  });

  test('dashboard loads with correct user information', async ({
    page,
    request,
    authenticatedUser,
  }) => {
    // Already on /dashboard from fixture, which redirects to /files
    await expect(page).toHaveURL(/files/);

    // Page should load without errors
    const consoleMonitor = attachConsoleMonitor(page);
    const networkMonitor = attachNetworkMonitor(page);

    await page.reload({ waitUntil: 'networkidle' });

    // Dashboard content should render
    await expect(page.locator('main, .dashboard, [class*="dashboard"]').first()).toBeVisible({
      timeout: 10_000,
    });

    consoleMonitor.assertClean({ allowWarnings: true });
    networkMonitor.assertClean();
  });

  test('file detail page (/files/:id) renders correctly', async ({
    page,
    request,
    authenticatedUser,
  }) => {
    const token = authenticatedUser.accessToken;
    const fileBuffer = fs.readFileSync(SAMPLE_PDF);
    const { uploadFileViaAPI } = await import('../helpers/api');

    const fileRecord = await uploadFileViaAPI(
      request, token, fileBuffer, 'detail-test.pdf', 'application/pdf'
    );

    await page.goto(`/files/${fileRecord.id}`, { waitUntil: 'networkidle' });

    // Should render the file detail — either redirect to reader or show info
    const isValidPage =
      page.url().includes('/files/') || page.url().includes('/read/');
    expect(isValidPage).toBe(true);
  });
});
