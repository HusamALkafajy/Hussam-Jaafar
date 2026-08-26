import { Injectable, BadRequestException } from '@nestjs/common';
import { db, quizMonthlyUsage, eq, and, sql } from '@studyai/database';

// ─── Free Launch product constant ───────────────────────────────────────────
//
// CANONICAL FREE LAUNCH LIMIT: 50 quiz generation capacity questions per
// UTC calendar month.
//
// This is the executable product constant for the ADR-008 / Q0 #2 monthly
// Quiz product quota.
//
// Do NOT change this constant without owner review.
// Do NOT reuse the stale 100 value from the legacy questionsUsedThisMonth
// pathway (which governs Document Chat, not Quiz generation).
// Do NOT confuse this limit with TokenCost, TokenAccountant, or any
// provider-token accounting system — they are completely separate.
//
export const FREE_QUIZ_QUESTIONS_PER_MONTH = 50;

// ─── Admission result ────────────────────────────────────────────────────────

export type QuizAdmissionResult =
  | { admitted: true; usedAfter: number }
  | { admitted: false; reason: 'MONTHLY_LIMIT_EXCEEDED' };

// ─── Current usage snapshot ──────────────────────────────────────────────────

export interface QuizUsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
  periodStart: string; // ISO date string: 'YYYY-MM-DD'
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * QuizMonthlyCapacityService — canonical monthly Quiz generation capacity.
 *
 * Design:
 *   One `quiz_monthly_usage` row per (user_id, period_start) where period_start
 *   is the first day of the UTC calendar month. New months naturally produce new
 *   rows — no cron reset, no Stripe dependency.
 *
 * Atomic admission:
 *   tryConsumeQuizCapacity executes a single INSERT … ON CONFLICT DO UPDATE …
 *   WHERE conditional. This prevents concurrent over-admission without a
 *   separate SELECT / application-level check.
 *
 * Consume-on-admission contract:
 *   Once admitted, capacity is consumed. No refund API is provided. This
 *   prevents unlimited retries against paid AI providers within the same
 *   monthly allowance.
 *
 * Scope:
 *   This service measures REQUESTED GENERATION CAPACITY, not provider tokens,
 *   not OpenRouter usage, not TokenCost. See ADR-008.
 */
@Injectable()
export class QuizMonthlyCapacityService {
  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Returns 'YYYY-MM-DD' string for the first day of the UTC month containing
   * the given date. Deterministic — safe for concurrency tests with injected time.
   */
  static utcMonthStart(date: Date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  // ── Admission ──────────────────────────────────────────────────────────────

  /**
   * Atomically attempt to consume `requestedQuestions` from the current UTC
   * calendar month bucket for `userId`.
   *
   * The entire admission is a single SQL statement:
   *
   *   INSERT INTO quiz_monthly_usage (user_id, period_start, used_questions, …)
   *   VALUES ($userId, $periodStart, $requested, …)
   *   ON CONFLICT (user_id, period_start)
   *   DO UPDATE
   *   SET used_questions = quiz_monthly_usage.used_questions + $requested,
   *       updated_at = now()
   *   WHERE quiz_monthly_usage.used_questions + $requested <= $limit
   *   RETURNING used_questions
   *
   * If the WHERE clause fails (over-quota), the DO UPDATE does not fire and
   * the INSERT falls back to a no-op excluded row — zero rows are returned.
   * A zero-row return means MONTHLY_LIMIT_EXCEEDED.
   *
   * @throws BadRequestException for invalid (non-positive or >limit) amounts.
   */
  async tryConsumeQuizCapacity(
    userId: string,
    requestedQuestions: number,
    now: Date = new Date(),
  ): Promise<QuizAdmissionResult> {
    if (!Number.isInteger(requestedQuestions) || requestedQuestions <= 0) {
      throw new BadRequestException(
        `Quiz capacity request must be a positive integer; received ${requestedQuestions}`,
      );
    }

    const limit = FREE_QUIZ_QUESTIONS_PER_MONTH;

    if (requestedQuestions > limit) {
      throw new BadRequestException(
        `Requested question count ${requestedQuestions} exceeds the maximum allowed per request (${limit})`,
      );
    }

    const periodStart = QuizMonthlyCapacityService.utcMonthStart(now);

    // Single atomic upsert with conditional WHERE.
    //
    // The WHERE guard on the DO UPDATE clause ensures that `used_questions`
    // cannot exceed `limit` even under concurrent requests. PostgreSQL evaluates
    // the WHERE clause atomically under a row-level lock before performing the
    // update, so two concurrent requests to take the remaining capacity (e.g.
    // both requesting 5 when 45 are used) will serialize: exactly one wins.
    //
    // IMPORTANT: When the WHERE guard prevents the UPDATE, PostgreSQL does NOT
    // update the row but the INSERT still returns a conflict — zero rows come
    // back from RETURNING. This is the signal for MONTHLY_LIMIT_EXCEEDED.
    const rows = await db
      .insert(quizMonthlyUsage)
      .values({
        userId,
        periodStart,
        usedQuestions: requestedQuestions,
      })
      .onConflictDoUpdate({
        target: [quizMonthlyUsage.userId, quizMonthlyUsage.periodStart],
        set: {
          usedQuestions: sql`${quizMonthlyUsage.usedQuestions} + ${requestedQuestions}`,
          updatedAt: sql`now()`,
        },
        setWhere: sql`${quizMonthlyUsage.usedQuestions} + ${requestedQuestions} <= ${limit}`,
      })
      .returning({ usedAfter: quizMonthlyUsage.usedQuestions });

    if (rows.length === 0) {
      return { admitted: false, reason: 'MONTHLY_LIMIT_EXCEEDED' };
    }

    return { admitted: true, usedAfter: rows[0].usedAfter };
  }

  // ── Read-only usage snapshot ───────────────────────────────────────────────

  /**
   * Returns the current-month usage snapshot for `userId`.
   *
   * If no row exists for the current month (first request of the month),
   * returns used = 0 without creating a row (read-only).
   */
  async getCurrentQuizUsage(userId: string, now: Date = new Date()): Promise<QuizUsageSnapshot> {
    const limit = FREE_QUIZ_QUESTIONS_PER_MONTH;
    const periodStart = QuizMonthlyCapacityService.utcMonthStart(now);

    const rows = await db
      .select({ usedQuestions: quizMonthlyUsage.usedQuestions })
      .from(quizMonthlyUsage)
      .where(
        and(
          eq(quizMonthlyUsage.userId, userId),
          eq(quizMonthlyUsage.periodStart, periodStart),
        ),
      )
      .limit(1);

    const used = rows.length > 0 ? rows[0].usedQuestions : 0;

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      periodStart,
    };
  }
}
