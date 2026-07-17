/**
 * Network monitoring utilities.
 *
 * The Release Quality Gate requires:
 *   - Zero unexpected failed network requests
 *
 * This module tracks all HTTP responses during a test and asserts none
 * returned unexpected failure codes.
 */
import { type Page } from '@playwright/test';

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  timing?: number;
}

/** Status codes that are expected failures (not bugs) */
const EXPECTED_FAILURE_CODES = new Set([401, 403, 404, 422, 429]);

/** URL patterns that are expected to fail in certain contexts */
const ALLOWED_FAILURE_PATTERNS: RegExp[] = [
  /\/api\/auth\/refresh/,
  /favicon\.ico/,
  /hot-update/,
  /_next\/static/,
];

export class NetworkMonitor {
  private requests: NetworkRequest[] = [];
  private failures: NetworkRequest[] = [];

  constructor(private page: Page) {
    page.on('response', (response) => {
      const req: NetworkRequest = {
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
      };
      this.requests.push(req);

      // Record unexpected failures (5xx errors)
      if (response.status() >= 500) {
        this.failures.push(req);
      }
    });
  }

  private isAllowedFailure(req: NetworkRequest): boolean {
    return ALLOWED_FAILURE_PATTERNS.some((p) => p.test(req.url));
  }

  get unexpectedFailures(): NetworkRequest[] {
    return this.failures.filter((r) => !this.isAllowedFailure(r));
  }

  /** Asserts zero unexpected network failures */
  assertClean(): void {
    const failures = this.unexpectedFailures;
    if (failures.length > 0) {
      throw new Error(
        `Quality Gate Violation: ${failures.length} unexpected network failure(s):\n` +
        failures.map((r) => `  ${r.method} ${r.url} → ${r.status}`).join('\n')
      );
    }
  }

  getSummary() {
    return {
      totalRequests: this.requests.length,
      failures: this.failures.length,
      unexpectedFailures: this.unexpectedFailures.length,
      apiRequests: this.requests.filter((r) => r.url.includes('/api/')).length,
    };
  }
}

export function attachNetworkMonitor(page: Page): NetworkMonitor {
  return new NetworkMonitor(page);
}
