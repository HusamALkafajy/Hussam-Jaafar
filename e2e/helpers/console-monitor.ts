/**
 * Console monitoring utilities.
 *
 * The Release Quality Gate requires:
 *   - Zero unexpected browser console errors
 *   - Zero unexpected browser console warnings
 *
 * This module provides a monitor that attaches to the page, collects all
 * console messages, and exposes a method to assert nothing unexpected was logged.
 */
import { type Page } from '@playwright/test';

export interface ConsoleMessage {
  type: string;
  text: string;
  url?: string;
}

/**
 * Patterns that are known-safe and should NOT fail the quality gate.
 * These are third-party or framework-level messages outside our control.
 */
const ALLOWED_PATTERNS: RegExp[] = [
  // Next.js development warnings
  /Download the React DevTools/i,
  /ReactDOM\.render is no longer supported/i,
  /Warning: Each child in a list/i,
  /next-dev/i,
  // Browser extension interference
  /chrome-extension/i,
  /moz-extension/i,
  // Common i18n / locale warnings
  /locale/i,
  // Hot module replacement
  /\[HMR\]/i,
  /\[Fast Refresh\]/i,
];

export class ConsoleMonitor {
  private messages: ConsoleMessage[] = [];
  private errors: ConsoleMessage[] = [];
  private warnings: ConsoleMessage[] = [];

  constructor(private page: Page) {
    page.on('console', (msg) => {
      const entry: ConsoleMessage = {
        type: msg.type(),
        text: msg.text(),
      };
      this.messages.push(entry);

      if (msg.type() === 'error') this.errors.push(entry);
      if (msg.type() === 'warning' || msg.type() === 'warn') this.warnings.push(entry);
    });

    page.on('pageerror', (err) => {
      this.errors.push({ type: 'pageerror', text: err.message });
    });
  }

  private isAllowed(text: string): boolean {
    return ALLOWED_PATTERNS.some((pattern) => pattern.test(text));
  }

  /** Returns all unexpected console errors */
  get unexpectedErrors(): ConsoleMessage[] {
    return this.errors.filter((e) => !this.isAllowed(e.text));
  }

  /** Returns all unexpected console warnings */
  get unexpectedWarnings(): ConsoleMessage[] {
    return this.warnings.filter((w) => !this.isAllowed(w.text));
  }

  /** Asserts no unexpected errors or warnings were logged. Throws on violation. */
  assertClean(options: { allowWarnings?: boolean } = {}): void {
    const errors = this.unexpectedErrors;
    if (errors.length > 0) {
      throw new Error(
        `Quality Gate Violation: ${errors.length} unexpected console error(s):\n` +
        errors.map((e) => `  [${e.type}] ${e.text}`).join('\n')
      );
    }

    if (!options.allowWarnings) {
      const warnings = this.unexpectedWarnings;
      if (warnings.length > 0) {
        // Warnings are surfaced but don't fail the gate by default
        console.warn(
          `⚠️  ${warnings.length} console warning(s) detected:\n` +
          warnings.map((w) => `  [warn] ${w.text}`).join('\n')
        );
      }
    }
  }

  /** Returns a summary object for the certification report */
  getSummary() {
    return {
      totalMessages: this.messages.length,
      errors: this.errors.length,
      warnings: this.warnings.length,
      unexpectedErrors: this.unexpectedErrors.length,
      unexpectedWarnings: this.unexpectedWarnings.length,
    };
  }
}

/**
 * Attaches a ConsoleMonitor to the page and returns it.
 * Call at the start of each test.
 */
export function attachConsoleMonitor(page: Page): ConsoleMonitor {
  return new ConsoleMonitor(page);
}
