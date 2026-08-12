/**
 * QuizMonthlyCapacityService — focused tests (ADR-008 / Q0 #2 Foundation)
 *
 * Real PostgreSQL validation:
 *   The concurrency test runs against studyai-postgres-test (port 5434).
 *   Uses real concurrent inserts to prove atomic admission.
 */

// Inject the test DB URL before any @studyai/database import resolves its client.
process.env.DATABASE_URL = 'postgresql://studyai_test:dummydummy@localhost:5434/studyai_test';

import {
  QuizMonthlyCapacityService,
  FREE_QUIZ_QUESTIONS_PER_MONTH,
} from './quiz-monthly-capacity.service';
import { db, quizMonthlyUsage, users, eq } from '@studyai/database';

jest.setTimeout(30000);

// ─── Deterministic test fixtures ─────────────────────────────────────────────

const USER_A = '00000000-2222-0000-0000-000000000001';
const USER_B = '00000000-2222-0000-0000-000000000002';
const USER_C = '00000000-2222-0000-0000-000000000003';

const AUG_2026 = new Date('2026-08-15T12:00:00Z');
const SEP_2026 = new Date('2026-09-15T12:00:00Z');

let service: QuizMonthlyCapacityService;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  service = new QuizMonthlyCapacityService();

  for (const userId of [USER_A, USER_B, USER_C]) {
    await db
      .insert(users)
      .values({
        id: userId,
        email: `quiz-quota-j-${userId}@test.local`,
        firstName: 'QuizTest',
        lastName: 'User',
        role: 'student' as const,
        authProvider: 'email' as const,
        locale: 'en' as const,
        emailVerified: false,
      })
      .onConflictDoNothing();
  }
});

afterAll(async () => {
  for (const userId of [USER_A, USER_B, USER_C]) {
    await db.delete(quizMonthlyUsage).where(eq(quizMonthlyUsage.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

beforeEach(async () => {
  for (const userId of [USER_A, USER_B, USER_C]) {
    await db.delete(quizMonthlyUsage).where(eq(quizMonthlyUsage.userId, userId));
  }
});

// ─── Phase 6: Canonical limit ─────────────────────────────────────────────────

describe('Phase 6: Canonical limit', () => {
  it('[Proof 15] FREE_QUIZ_QUESTIONS_PER_MONTH is exactly 50', () => {
    expect(FREE_QUIZ_QUESTIONS_PER_MONTH).toBe(50);
  });

  it('[Proof 13] non-positive amount throws BadRequestException', async () => {
    await expect(service.tryConsumeQuizCapacity(USER_A, 0, AUG_2026)).rejects.toThrow(
      /positive integer/i,
    );
    await expect(service.tryConsumeQuizCapacity(USER_A, -1, AUG_2026)).rejects.toThrow(
      /positive integer/i,
    );
  });

  it('[Proof 14] >50 single request throws BadRequestException', async () => {
    await expect(service.tryConsumeQuizCapacity(USER_A, 51, AUG_2026)).rejects.toThrow(
      /exceeds the maximum/i,
    );
  });
});

// ─── Phase 4: UTC period helper ───────────────────────────────────────────────

describe('Phase 4: UTC period representation', () => {
  it('utcMonthStart returns 2026-08-01 for mid-August', () => {
    expect(QuizMonthlyCapacityService.utcMonthStart(AUG_2026)).toBe('2026-08-01');
  });

  it('utcMonthStart returns 2026-09-01 for mid-September', () => {
    expect(QuizMonthlyCapacityService.utcMonthStart(SEP_2026)).toBe('2026-09-01');
  });

  it('utcMonthStart returns 2026-08-01 for 2026-08-31T23:59:59Z', () => {
    expect(
      QuizMonthlyCapacityService.utcMonthStart(new Date('2026-08-31T23:59:59Z')),
    ).toBe('2026-08-01');
  });

  it('utcMonthStart returns 2026-09-01 for 2026-09-01T00:00:00Z', () => {
    expect(
      QuizMonthlyCapacityService.utcMonthStart(new Date('2026-09-01T00:00:00Z')),
    ).toBe('2026-09-01');
  });
});

// ─── Phase 7/8: Atomic admission ─────────────────────────────────────────────

describe('Phase 7/8: Atomic admission and service contract', () => {
  it('[Proof 1] first request creates bucket and is admitted', async () => {
    const result = await service.tryConsumeQuizCapacity(USER_A, 5, AUG_2026);
    expect(result.admitted).toBe(true);
    if (result.admitted) expect(result.usedAfter).toBe(5);
  });

  it('[Proof 2] same-month usage accumulates across requests', async () => {
    await service.tryConsumeQuizCapacity(USER_A, 5, AUG_2026);
    await service.tryConsumeQuizCapacity(USER_A, 10, AUG_2026);
    const snap = await service.getCurrentQuizUsage(USER_A, AUG_2026);
    expect(snap.used).toBe(15);
  });

  it('[Proof 3] usage exactly reaching 50 is admitted', async () => {
    const result = await service.tryConsumeQuizCapacity(USER_A, 50, AUG_2026);
    expect(result.admitted).toBe(true);
    if (result.admitted) expect(result.usedAfter).toBe(50);
  });

  it('[Proof 4] request that would exceed 50 is denied with MONTHLY_LIMIT_EXCEEDED', async () => {
    await service.tryConsumeQuizCapacity(USER_A, 50, AUG_2026);
    const result = await service.tryConsumeQuizCapacity(USER_A, 5, AUG_2026);
    expect(result.admitted).toBe(false);
    if (!result.admitted) expect(result.reason).toBe('MONTHLY_LIMIT_EXCEEDED');
  });

  it('[Proof 5] denied admission leaves usage unchanged', async () => {
    await service.tryConsumeQuizCapacity(USER_A, 48, AUG_2026);
    const denied = await service.tryConsumeQuizCapacity(USER_A, 5, AUG_2026);
    expect(denied.admitted).toBe(false);
    const snap = await service.getCurrentQuizUsage(USER_A, AUG_2026);
    expect(snap.used).toBe(48);
  });
});

// ─── Phase 9: REAL POSTGRES CONCURRENCY ──────────────────────────────────────

describe('Phase 9: Real PostgreSQL concurrency (45 + concurrent 5 + 5)', () => {
  it('[Proof 6+7] exactly ONE of two concurrent 5-question requests admitted when used=45', async () => {
    const prefill = await service.tryConsumeQuizCapacity(USER_B, 45, AUG_2026);
    expect(prefill.admitted).toBe(true);

    // Fire both in parallel against real PostgreSQL — PostgreSQL's row-level
    // lock inside ON CONFLICT DO UPDATE serializes the conditional WHERE.
    const [r1, r2] = await Promise.all([
      service.tryConsumeQuizCapacity(USER_B, 5, AUG_2026),
      service.tryConsumeQuizCapacity(USER_B, 5, AUG_2026),
    ]);

    const admissions = [r1, r2].filter((r) => r.admitted).length;
    const denials = [r1, r2].filter((r) => !r.admitted).length;

    expect(admissions).toBe(1);
    expect(denials).toBe(1);

    const snap = await service.getCurrentQuizUsage(USER_B, AUG_2026);
    expect(snap.used).toBe(50);
  });
});

// ─── Phase 5: Natural month reset ────────────────────────────────────────────

describe('Phase 5: Natural month reset — August ↔ September isolation', () => {
  it('[Proof 8] September bucket is independent from August', async () => {
    await service.tryConsumeQuizCapacity(USER_C, 30, AUG_2026);
    const aug = await service.getCurrentQuizUsage(USER_C, AUG_2026);
    const sep = await service.getCurrentQuizUsage(USER_C, SEP_2026);
    expect(aug.used).toBe(30);
    expect(sep.used).toBe(0);
  });

  it('[Proof 9] August exhausted does NOT block September admission', async () => {
    await service.tryConsumeQuizCapacity(USER_C, 50, AUG_2026);
    const result = await service.tryConsumeQuizCapacity(USER_C, 5, SEP_2026);
    expect(result.admitted).toBe(true);
  });

  it('August and September produce distinct DB rows', async () => {
    await service.tryConsumeQuizCapacity(USER_C, 5, AUG_2026);
    await service.tryConsumeQuizCapacity(USER_C, 10, SEP_2026);
    const rows = await db
      .select()
      .from(quizMonthlyUsage)
      .where(eq(quizMonthlyUsage.userId, USER_C));
    expect(rows.length).toBe(2);
    const periods = rows.map((r) => r.periodStart).sort();
    expect(periods[0]).toBe('2026-08-01');
    expect(periods[1]).toBe('2026-09-01');
  });
});

// ─── getCurrentQuizUsage ──────────────────────────────────────────────────────

describe('getCurrentQuizUsage', () => {
  it('[Proof 10] returns correct used count', async () => {
    await service.tryConsumeQuizCapacity(USER_A, 20, AUG_2026);
    const snap = await service.getCurrentQuizUsage(USER_A, AUG_2026);
    expect(snap.used).toBe(20);
  });

  it('[Proof 11] remaining = limit - used', async () => {
    await service.tryConsumeQuizCapacity(USER_A, 20, AUG_2026);
    const snap = await service.getCurrentQuizUsage(USER_A, AUG_2026);
    expect(snap.remaining).toBe(30);
    expect(snap.limit).toBe(50);
    expect(snap.used + snap.remaining).toBe(snap.limit);
  });

  it('[Proof 12] no usage row means used = 0, remaining = 50', async () => {
    const snap = await service.getCurrentQuizUsage(USER_A, AUG_2026);
    expect(snap.used).toBe(0);
    expect(snap.remaining).toBe(50);
  });

  it('periodStart returned correctly', async () => {
    const snap = await service.getCurrentQuizUsage(USER_A, AUG_2026);
    expect(snap.periodStart).toBe('2026-08-01');
  });
});

// ─── Phase 15/16: Separation from infrastructure ─────────────────────────────

describe('Phase 15/16: Isolation from TokenCost / Stripe / TokenAccountant', () => {
  it('[Proof 16] admission works without any subscription row', async () => {
    const result = await service.tryConsumeQuizCapacity(USER_A, 5, AUG_2026);
    expect(result.admitted).toBe(true);
  });

  it('[Proof 17] service has no Redis / TokenAccountant constructor dependency', () => {
    const svc = service as any;
    expect(svc.tokenAccountant).toBeUndefined();
    expect(svc.redis).toBeUndefined();
  });

  it('[Proof 18] tryConsumeQuizCapacity carries no TokenCost decorator metadata', () => {
    const meta = Reflect.getMetadata(
      'TOKEN_COST_KEY',
      QuizMonthlyCapacityService.prototype,
      'tryConsumeQuizCapacity',
    );
    expect(meta).toBeUndefined();
  });
});

// ─── Phase 11: No refund API ──────────────────────────────────────────────────

describe('Phase 11: Consume-on-admission — no refund API', () => {
  it('service exposes no release/refund/rollback method', () => {
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    ['release', 'refund', 'rollback', 'releaseCapacity', 'releaseQuizCapacity'].forEach((name) => {
      expect(proto).not.toContain(name);
    });
  });

  it('usage is not decremented after simulated AI failure (no API to do so)', async () => {
    await service.tryConsumeQuizCapacity(USER_A, 5, AUG_2026);
    const snap = await service.getCurrentQuizUsage(USER_A, AUG_2026);
    expect(snap.used).toBe(5);
  });
});
