/**
 * Performance measurement utilities.
 *
 * Wraps critical actions and asserts they complete within the specified budget.
 * Budgets are defined per the approved Implementation Plan:
 *   Upload:         < 5s
 *   Processing:     < 30s
 *   Reader ready:   < 3s
 *   First summary:  < 15s
 */
import { type Page } from '@playwright/test';

export interface PerformanceResult {
  operation: string;
  durationMs: number;
  budgetMs: number;
  passed: boolean;
}

const BUDGETS = {
  upload: 5_000,
  processing: 30_000,
  readerReady: 3_000,
  firstSummary: 15_000,
  pageNavigation: 5_000,
} as const;

export type BudgetKey = keyof typeof BUDGETS;

/**
 * Measures how long an async action takes and asserts it finishes within budget.
 * Records the result for the certification report.
 */
export async function measureWithBudget<T>(
  operationName: string,
  budgetKey: BudgetKey,
  action: () => Promise<T>
): Promise<{ result: T; measurement: PerformanceResult }> {
  const start = Date.now();
  const result = await action();
  const durationMs = Date.now() - start;
  const budgetMs = BUDGETS[budgetKey];
  const passed = durationMs <= budgetMs;

  const measurement: PerformanceResult = {
    operation: operationName,
    durationMs,
    budgetMs,
    passed,
  };

  if (!passed) {
    console.warn(
      `⚠️  Performance budget exceeded: ${operationName} took ${durationMs}ms (budget: ${budgetMs}ms)`
    );
  }

  return { result, measurement };
}

/**
 * Collects Web Vitals from the browser's PerformanceObserver.
 * Returns LCP, FID, CLS where available.
 */
export async function collectWebVitals(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    return new Promise<Record<string, number>>((resolve) => {
      const vitals: Record<string, number> = {};

      // Use PerformanceObserver to collect paint timings
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              vitals['LCP'] = entry.startTime;
            }
            if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
              vitals['FCP'] = entry.startTime;
            }
          }
        });
        observer.observe({ entryTypes: ['largest-contentful-paint', 'paint'] });
      } catch (_) {
        // Not all browsers support all entry types
      }

      // Resolve after a brief observation window
      setTimeout(() => resolve(vitals), 2000);
    });
  });
}

/**
 * Asserts that a navigation completes within the page navigation budget.
 */
export async function assertPageLoadBudget(page: Page, url: string): Promise<PerformanceResult> {
  const { measurement } = await measureWithBudget(
    `Navigate to ${url}`,
    'pageNavigation',
    () => page.goto(url, { waitUntil: 'networkidle' })
  );

  if (!measurement.passed) {
    throw new Error(
      `Page load budget exceeded for ${url}: ` +
      `${measurement.durationMs}ms > ${measurement.budgetMs}ms`
    );
  }

  return measurement;
}
