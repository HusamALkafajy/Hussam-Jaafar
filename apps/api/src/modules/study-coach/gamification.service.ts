import { Injectable, Logger } from '@nestjs/common';
import { db, studentProfiles, badges, userBadges, challenges, userChallenges, eq, and, sql } from '@studyai/database';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  // Get user badges
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

  // Get active challenges for user
  async getActiveChallenges(userId: string) {
    const now = new Date();

    const active = await db
      .select()
      .from(challenges)
      .where(
        and(
          sql`${challenges.startDate} <= ${now}`,
          sql`${challenges.endDate} >= ${now}`
        )
      );

    const result = [];
    for (const challenge of active) {
      let progress = await db
        .select()
        .from(userChallenges)
        .where(
          and(
            eq(userChallenges.userId, userId),
            eq(userChallenges.challengeId, challenge.id)
          )
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
        targetValue: challenge.targetValue,
        currentValue: progress[0].currentValue,
        isCompleted: progress[0].isCompleted,
        completedAt: progress[0].completedAt,
        xpReward: challenge.xpReward,
      });
    }

    return result;
  }

  // Increment progress for a challenge type
  async updateChallengeProgress(userId: string, type: 'daily' | 'weekly', incrementValue: number) {
    const activeChallenges = await this.getActiveChallenges(userId);
    const matches = activeChallenges.filter((c) => c.type === type && !c.isCompleted);

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
            eq(userChallenges.challengeId, ch.id)
          )
        );

      if (isNowCompleted) {
        this.logger.log(`Challenge completed! Rewarding ${ch.xpReward} XP to user ${userId}`);
        await this.addXp(userId, ch.xpReward);
      }
    }
  }

  // Add XP and handle level up
  async addXp(userId: string, amount: number) {
    const profileResult = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, userId))
      .limit(1);

    if (profileResult.length === 0) return { xpEarned: amount, totalXp: amount, level: 1, hasLeveledUp: false };
    const profile = profileResult[0];

    const newXp = profile.xp + amount;
    const xpNeededPerLevel = 100;
    const newLevel = Math.floor(newXp / xpNeededPerLevel) + 1;
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

    return {
      xpEarned: amount,
      totalXp: newXp,
      level: newLevel,
      hasLeveledUp,
    };
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
      .where(
        and(
          eq(userBadges.userId, userId),
          eq(userBadges.badgeId, badge.id)
        )
      )
      .limit(1);

    if (hasBadge.length === 0) {
      await db.insert(userBadges).values({
        userId,
        badgeId: badge.id,
      });
      await this.addXp(userId, badge.xpReward);
      this.logger.log(`Awarded badge ${badge.name} to user ${userId}`);
    }
  }

  // Award custom badge directly
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
      .where(
        and(
          eq(userBadges.userId, userId),
          eq(userBadges.badgeId, badge.id)
        )
      )
      .limit(1);

    if (hasBadge.length === 0) {
      await db.insert(userBadges).values({
        userId,
        badgeId: badge.id,
      });
      await this.addXp(userId, badge.xpReward);
      return { success: true, badge };
    }
    return { success: false, message: 'Badge already earned' };
  }
}
