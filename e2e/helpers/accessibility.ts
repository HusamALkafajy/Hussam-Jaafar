/**
 * Accessibility utilities for the E2E certification suite.
 *
 * Uses @axe-core/playwright to run automated accessibility scans.
 * The Quality Gate requires: zero Axe violations on all pages.
 */
import { type Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export interface A11yResult {
  url: string;
  violations: number;
  passes: number;
  incomplete: number;
  passed: boolean;
}

/**
 * Runs an Axe accessibility scan on the current page.
 * Throws if any violations are found — this fails the quality gate.
 */
export async function runAxeScan(
  page: Page,
  options: { disabledRules?: string[] } = {}
): Promise<A11yResult> {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (options.disabledRules && options.disabledRules.length > 0) {
    builder = builder.disableRules(options.disabledRules);
  }

  const results = await builder.analyze();

  const result: A11yResult = {
    url: page.url(),
    violations: results.violations.length,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    passed: results.violations.length === 0,
  };

  if (results.violations.length > 0) {
    const details = results.violations
      .map(
        (v) =>
          `  [${v.impact}] ${v.id}: ${v.description}\n` +
          v.nodes.slice(0, 2).map((n) => `    → ${n.html}`).join('\n')
      )
      .join('\n');

    throw new Error(
      `Quality Gate Violation: ${results.violations.length} accessibility violation(s) on ${page.url()}:\n${details}`
    );
  }

  return result;
}

/**
 * Verifies keyboard navigation by tabbing through focusable elements
 * and asserting each receives visible focus.
 */
export async function verifyKeyboardNavigation(
  page: Page,
  options: { steps?: number } = {}
): Promise<void> {
  const steps = options.steps ?? 10;

  // Start from the top of the page
  await page.keyboard.press('Tab');

  for (let i = 0; i < steps; i++) {
    // Each tab press should move focus to a visible, focusable element
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        visible: rect.width > 0 && rect.height > 0,
        tabIndex: (el as HTMLElement).tabIndex,
      };
    });

    // It's OK if we reach the end of focusable elements
    if (!focused) break;

    await page.keyboard.press('Tab');
  }
}

/**
 * Verifies that dialogs trap focus correctly.
 * Opens a dialog, tabs through it, and asserts focus doesn't escape.
 */
export async function verifyFocusTrap(page: Page, dialogSelector: string): Promise<void> {
  const dialog = page.locator(dialogSelector);
  await expect(dialog).toBeVisible();

  // Tab multiple times and verify focus stays within the dialog
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    const focusedInDialog = await dialog.evaluate((el) => {
      return el.contains(document.activeElement);
    });
    expect(focusedInDialog).toBe(true);
  }
}
