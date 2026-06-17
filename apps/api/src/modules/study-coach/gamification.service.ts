import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { db, studentProfiles, badges, userBadges, challenges, userChallenges, users, eq, and, sql, desc } from '@studyai/database';

export const DEFAULT_BADGES = [
  {
    code: 'level_5',
    name: 'Level 5 Achiever',
    description: 'Reached Level 5 to unlock this achievement.',
    iconUrl: 'trophy',
    xpReward: 100,
  },
  {
    code: 'level_10',
    name: 'Level 10 Master',
    description: 'Reached Level 10 to unlock this achievement.',
    iconUrl: 'crown',
    xpReward: 250,
  },
  {
    code: 'level_25',
    name: 'Level 25 Legend',
    description: 'Reached Level 25 to unlock this achievement.',
    iconUrl: 'gem',
    xpReward: 500,
  },
  {
    code: 'first_lesson',
    name: 'First Steps',
    description: 'Completed your first lesson.',
    iconUrl: 'book',
    xpReward: 50,
  },
  {
    code: 'first_project',
    name: 'Real Builder',
    description: 'Submitted and passed your first project.',
    iconUrl: 'code',
    xpReward: 100,
  },
];

// ── Challenge seed definitions ───────────────────────────────────────────────
// Rotated daily by index of day-of-year mod array length.
// Rotated weekly by index of week-of-year mod array length.

const DAILY_CHALLENGE_SEEDS = [
  { title: 'رافع اليوم', description: 'ارفع ملفاً واحداً اليوم', targetValue: 1, xpReward: 25, category: 'upload' },
  { title: 'مراجع البطاقات', description: 'راجع 10 بطاقات فلاش اليوم', targetValue: 10, xpReward: 30, category: 'flashcard' },
  { title: 'خاض الاختبار', description: 'أكمل اختباراً واحداً اليوم', targetValue: 1, xpReward: 40, category: 'exam' },
  { title: 'مدوّن اليوم', description: 'أضف 3 ملاحظات اليوم', targetValue: 3, xpReward: 20, category: 'note' },
  { title: 'المثابر', description: 'راجع 5 بطاقات فلاش اليوم', targetValue: 5, xpReward: 20, category: 'flashcard' },
  { title: 'الباحث', description: 'ارفع ملفين اليوم', targetValue: 2, xpReward: 35, category: 'upload' },
  { title: 'الذكي', description: 'أضف ملاحظة ذكية واحدة اليوم', targetValue: 1, xpReward: 15, category: 'note' },
];

const WEEKLY_CHALLENGE_SEEDS = [
  { title: 'أسبوع الرفع', description: 'ارفع 5 ملفات هذا الأسبوع', targetValue: 5, xpReward: 100, category: 'upload' },
  { title: 'أسبوع الاختبارات', description: 'أكمل 3 اختبارات هذا الأسبوع', targetValue: 3, xpReward: 150, category: 'exam' },
  { title: 'أسبوع البطاقات', description: 'راجع 50 بطاقة فلاش هذا الأسبوع', targetValue: 50, xpReward: 120, category: 'flashcard' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d = new Date()): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d = new Date()): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function startOfWeek(d = new Date()): Date {
  const r = new Date(d);
  const day = r.getDay(); // 0=Sun
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfWeek(d = new Date()): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() + (6 - day));
  r.setHours(23, 59, 59, 999);
  return r;
}

function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function weekOfYear(d = new Date()): number {
  return Math.ceil(dayOfYear(d) / 7);
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GamificationService implements OnModuleInit {
  private readonly logger = new Logger(GamificationService.name);

  async onModuleInit() {
    this.logger.log('Bootstrapping default badges...');
    try {
      for (const badge of DEFAULT_BADGES) {
        const existing = await db
          .select()
          .from(badges)
          .where(eq(badges.code, badge.code))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(badges).values(badge);
          this.logger.log(`Created default badge: ${badge.name}`);
        }
      }
    } catch (err) {
      this.logger.error('Failed to bootstrap default badges', err);
    }

    await this.seedPeriodicChallenges();
  }

  // ── Level / XP helpers ────────────────────────────────────────────────────

  // Calculate level based on dynamic quadratic threshold:
  // Level 1: 0 - 100 XP (threshold for Lvl 2 = 100)
  // Level 2: 100 - 300 XP (threshold for Lvl 3 = 300)
  // Formula: threshold(L) = 50 * (L - 1) * L
  getLevelFromXp(xp: number): number {
    let level = 1;
    while (xp >= this.getXpThresholdForLevel(level + 1)) {
      level++;
    }
    return level;
  }

  getXpThresholdForLevel(level: number): number {
    if (level <= 1) return 0;
    return 50 * (level - 1) * level;
  }

  // ── Periodic challenge seeding ─────────────────────────────────────────────

  /**
   * Seeds today's daily challenge and this week's weekly challenge if they do
   * not yet exist. Uses rotating seed arrays keyed by day-of-year and week-of-year.
   * Safe to call repeatedly (idempotent via startDate window check).
   */
  async seedPeriodicChallenges() {
    try {
      const now = new Date();

      // ── Daily ──
      const dailySeed = DAILY_CHALLENGE_SEEDS[dayOfYear(now) % DAILY_CHALLENGE_SEEDS.length];
      const dayStart = startOfDay(now);
      const dayEnd = endOfDay(now);

      const existingDaily = await db
        .select()
        .from(challenges)
        .where(
          and(
            eq(challenges.category, dailySeed.category),
            eq(challenges.isAutoGenerated, true),
            sql`${challenges.type} = 'daily'`,
            sql`${challenges.startDate} >= ${dayStart.toISOString()}`,
            sql`${challenges.startDate} <= ${dayEnd.toISOString()}`,
          ),
        )
        .limit(1);

      if (existingDaily.length === 0) {
        await db.insert(challenges).values({
          ...dailySeed,
          type: 'daily',
          isAutoGenerated: true,
          startDate: dayStart,
          endDate: dayEnd,
        });
        this.logger.log(`Seeded daily challenge: ${dailySeed.title}`);
      }

      // ── Weekly ──
      const weeklySeed = WEEKLY_CHALLENGE_SEEDS[weekOfYear(now) % WEEKLY_CHALLENGE_SEEDS.length];
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);

      const existingWeekly = await db
        .select()
        .from(challenges)
        .where(
          and(
            eq(challenges.category, weeklySeed.category),
            eq(challenges.isAutoGenerated, true),
            sql`${challenges.type} = 'weekly'`,
            sql`${challenges.startDate} >= ${weekStart.toISOString()}`,
            sql`${challenges.startDate} <= ${weekEnd.toISOString()}`,
          ),
        )
        .limit(1);

      if (existingWeekly.length === 0) {
        await db.insert(challenges).values({
          ...weeklySeed,
          type: 'weekly',
          isAutoGenerated: true,
          startDate: weekStart,
          endDate: weekEnd,
        });
        this.logger.log(`Seeded weekly challenge: ${weeklySeed.title}`);
      }
    } catch (err) {
      this.logger.error('Failed to seed periodic challenges', err);
    }
  }

  // ── Badges ────────────────────────────────────────────────────────────────

  async getBadges(userId: string) {
    const earned = await db
      .select({
        id: badges.id,
        code: badges.code,
        name: badges.name,
        description: badges.description,
        iconUrl: badges.iconUrl,
        xpReward: badges.xpReward,
        earnedAt: userBadges.earnedAt,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId));

    const allBadges = await db.select().from(badges);

    return {
      earned,
      all: allBadges.map((b) => ({
        ...b,
        isEarned: earned.some((e) => e.id === b.id),
      })),
    };
  }

  // ── Challenges ────────────────────────────────────────────────────────────

  /** Returns all currently active challenges with this user's progress. */
  async getActiveChallenges(userId: string) {
    const now = new Date();

    const active = await db
      .select()
      .from(challenges)
      .where(
        and(
          sql`${challenges.startDate} <= ${now.toISOString()}`,
          sql`${challenges.endDate} >= ${now.toISOString()}`,
        ),
      );

    const result = [];
    for (const challenge of active) {
      let progress = await db
        .select()
        .from(userChallenges)
        .where(
          and(
            eq(userChallenges.userId, userId),
            eq(userChallenges.challengeId, challenge.id),
          ),
        )
        .limit(1);

      if (progress.length === 0) {
        const created = await db
          .insert(userChallenges)
          .values({
            userId,
            challengeId: challenge.id,
            currentValue: 0,
            isCompleted: false,
          })
          .returning();
        progress = [created[0]];
      }

      result.push({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.type,
        category: challenge.category,
        targetValue: challenge.targetValue,
        currentValue: progress[0].currentValue,
        isCompleted: progress[0].isCompleted,
        completedAt: progress[0].completedAt,
        xpReward: challenge.xpReward,
        endDate: challenge.endDate,
      });
    }

    return result;
  }

  /**
   * Increment progress on all active challenges matching the given category.
   * Called by files, exams, flashcards, and notes services after a successful action.
   *
   * @param category - action type: 'upload' | 'exam' | 'note' | 'flashcard' | 'study_minutes'
   */
  async updateChallengeProgress(userId: string, category: string, incrementValue: number) {
    const activeChallenges = await this.getActiveChallenges(userId);
    // Match on category (new precise filter) and skip already completed challenges
    const matches = activeChallenges.filter(
      (c) => c.category === category && !c.isCompleted,
    );

    for (const ch of matches) {
      const newValue = Math.min(ch.currentValue + incrementValue, ch.targetValue);
      const isNowCompleted = newValue >= ch.targetValue;

      await db
        .update(userChallenges)
        .set({
          currentValue: newValue,
          isCompleted: isNowCompleted,
          completedAt: isNowCompleted ? new Date() : null,
        })
        .where(
          and(
            eq(userChallenges.userId, userId),
            eq(userChallenges.challengeId, ch.id),
          ),
        );

      if (isNowCompleted) {
        this.logger.log(`Challenge "${ch.title}" completed! Rewarding ${ch.xpReward} XP to user ${userId}`);
        await this.addXp(userId, ch.xpReward);
      }
    }
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────

  /**
   * Returns the top-N users by XP for a global leaderboard.
   * Privacy: only displays firstName + first initial of lastName (e.g. "Hussam J.").
   * Does not expose userId, email, or any sensitive field.
   */
  async getLeaderboard(limit = 20): Promise<Array<{
    rank: number;
    displayName: string;
    avatarUrl: string | null;
    xp: number;
    level: number;
  }>> {
    const rows = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
        xp: studentProfiles.xp,
        currentLevel: studentProfiles.currentLevel,
      })
      .from(studentProfiles)
      .innerJoin(users, eq(studentProfiles.userId, users.id))
      .orderBy(desc(studentProfiles.xp))
      .limit(limit);

    return rows.map((row, i) => ({
      rank: i + 1,
      // "John D." — never expose full last name
      displayName: `${row.firstName} ${row.lastName ? row.lastName[0] + '.' : ''}`.trim(),
      avatarUrl: row.avatarUrl ?? null,
      xp: row.xp,
      level: row.currentLevel,
    }));
  }

  // ── XP & Levels ───────────────────────────────────────────────────────────

  async addXp(userId: string, amount: number) {
    const profileResult = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, userId))
      .limit(1);

    if (profileResult.length === 0) return { xpEarned: amount, totalXp: amount, level: 1, hasLeveledUp: false };
    const profile = profileResult[0];

    const newXp = profile.xp + amount;
    const newLevel = this.getLevelFromXp(newXp);
    const hasLeveledUp = newLevel > profile.currentLevel;

    await db
      .update(studentProfiles)
      .set({
        xp: newXp,
        currentLevel: newLevel,
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.userId, userId));

    if (hasLeveledUp) {
      this.logger.log(`User ${userId} leveled up to Level ${newLevel}!`);
      await this.awardLevelBadgeIfNeeded(userId, newLevel);
    }

    return { xpEarned: amount, totalXp: newXp, level: newLevel, hasLeveledUp };
  }

  private async awardLevelBadgeIfNeeded(userId: string, level: number) {
    let badgeCode = '';
    if (level >= 5 && level < 10) badgeCode = 'level_5';
    else if (level >= 10 && level < 25) badgeCode = 'level_10';
    else if (level >= 25) badgeCode = 'level_25';

    if (!badgeCode) return;

    const badgeResult = await db
      .select()
      .from(badges)
      .where(eq(badges.code, badgeCode))
      .limit(1);

    if (badgeResult.length === 0) return;
    const badge = badgeResult[0];

    const hasBadge = await db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id)))
      .limit(1);

    if (hasBadge.length === 0) {
      await db.insert(userBadges).values({ userId, badgeId: badge.id });
      await this.addXp(userId, badge.xpReward);
      this.logger.log(`Awarded badge ${badge.name} to user ${userId}`);
    }
  }

  async awardBadgeByCode(userId: string, code: string) {
    const badgeResult = await db
      .select()
      .from(badges)
      .where(eq(badges.code, code))
      .limit(1);

    if (badgeResult.length === 0) return { success: false, message: 'Badge not found' };
    const badge = badgeResult[0];

    const hasBadge = await db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id)))
      .limit(1);

    if (hasBadge.length === 0) {
      await db.insert(userBadges).values({ userId, badgeId: badge.id });
      await this.addXp(userId, badge.xpReward);
      return { success: true, badge };
    }
    return { success: false, message: 'Badge already earned' };
  }
}
