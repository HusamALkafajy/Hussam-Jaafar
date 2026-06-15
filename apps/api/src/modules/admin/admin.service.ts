import { Injectable, NotFoundException } from '@nestjs/common';
import { db, users, payments, activityLogs, files, exams, aiTokenUsage, subscriptions, eq, and, or, desc, sql } from '@studyai/database';
import { UserRole, SubscriptionTier } from '@studyai/types';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@Injectable()
export class AdminService {
  async getUsers(query: AdminUsersQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;
    const conditions = [];

    if (query.search) {
      conditions.push(
        or(
          sql`${users.email} ILIKE ${`%${query.search}%`}`,
          sql`${users.firstName} ILIKE ${`%${query.search}%`}`,
          sql`${users.lastName} ILIKE ${`%${query.search}%`}`,
        ),
      );
    }
    if (query.role) {
      conditions.push(eq(users.role, query.role));
    }
    if (query.plan) {
      conditions.push(eq(users.subscriptionTier, query.plan));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        subscriptionTier: users.subscriptionTier,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async setUserActiveStatus(userId: string, isActive: boolean) {
    const [updated] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return updated;
  }

  async changeUserRole(userId: string, role: UserRole) {
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return updated;
  }

  async getBillingStats() {
    const [totalRevResult] = await db
      .select({ total: sql<number>`coalesce(sum(cast(${payments.amount} as decimal)), 0)` })
      .from(payments)
      .where(eq(payments.status, 'succeeded'));
    const totalRevenue = parseFloat(Number(totalRevResult?.total || 0).toFixed(2));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [monthlyRevResult] = await db
      .select({ total: sql<number>`coalesce(sum(cast(${payments.amount} as decimal)), 0)` })
      .from(payments)
      .where(and(
        eq(payments.status, 'succeeded'),
        sql`${payments.createdAt} >= ${thirtyDaysAgo}`,
      ));
    const monthlyRevenue = parseFloat(Number(monthlyRevResult?.total || 0).toFixed(2));

    // Calculate MRR / ARR from active subscriptions
    const activeSubscriptions = await db
      .select({
        plan: subscriptions.plan,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
      .groupBy(subscriptions.plan);

    let mrr = 0;
    for (const sub of activeSubscriptions) {
      if (sub.plan === 'pro') {
        mrr += Number(sub.count) * 15.00;
      } else if (sub.plan === 'institution') {
        mrr += Number(sub.count) * 150.00;
      }
    }
    const arr = mrr * 12;

    // Calculate net profit = totalRevenue - totalAiCost
    const [totalAiCostResult] = await db
      .select({ total: sql<number>`coalesce(sum(cast(${aiTokenUsage.costUSD} as decimal)), 0)` })
      .from(aiTokenUsage);
    const totalAiCost = parseFloat(Number(totalAiCostResult?.total || 0).toFixed(6));
    const netProfit = parseFloat((totalRevenue - totalAiCost).toFixed(2));

    const recentPayments = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
        invoiceUrl: payments.invoiceUrl,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .orderBy(desc(payments.createdAt))
      .limit(20);

    return {
      totalRevenue,
      monthlyRevenue,
      mrr,
      arr,
      totalAiCost,
      netProfit,
      recentPayments,
    };
  }

  async getAiStats() {
    const aiActions = ['summary', 'explanation', 'chat', 'exam'];
    const promptCountsResult = await db
      .select({
        action: activityLogs.action,
        count: sql<number>`count(*)`,
      })
      .from(activityLogs)
      .where(sql`${activityLogs.action} in ('summary', 'explanation', 'chat', 'exam')`)
      .groupBy(activityLogs.action);

    const promptCounts = {
      summary: 0,
      explanation: 0,
      chat: 0,
      exam: 0,
    };

    for (const row of promptCountsResult) {
      const act = row.action as keyof typeof promptCounts;
      if (act in promptCounts) {
        promptCounts[act] = Number(row.count);
      }
    }

    const totalRequests = Object.values(promptCounts).reduce((a, b) => a + b, 0);

    const agentAggregates = await db
      .select({
        agentType: aiTokenUsage.agentType,
        totalPromptTokens: sql<number>`coalesce(sum(${aiTokenUsage.promptTokens}), 0)`,
        totalCompletionTokens: sql<number>`coalesce(sum(${aiTokenUsage.completionTokens}), 0)`,
        totalCostUSD: sql<number>`coalesce(sum(cast(${aiTokenUsage.costUSD} as decimal)), 0)`,
        requestCount: sql<number>`count(*)`,
      })
      .from(aiTokenUsage)
      .groupBy(aiTokenUsage.agentType);

    const modelAggregates = await db
      .select({
        model: aiTokenUsage.model,
        totalCostUSD: sql<number>`coalesce(sum(cast(${aiTokenUsage.costUSD} as decimal)), 0)`,
        requestCount: sql<number>`count(*)`,
      })
      .from(aiTokenUsage)
      .groupBy(aiTokenUsage.model);

    const errorLogs = await db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        action: activityLogs.action,
        resourceType: activityLogs.resourceType,
        resourceId: activityLogs.resourceId,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
        user: {
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(activityLogs)
      .innerJoin(users, eq(activityLogs.userId, users.id))
      .where(
        or(
          eq(activityLogs.resourceType, 'error'),
          sql`${activityLogs.resourceType} ILIKE '%error%'`,
        ),
      )
      .orderBy(desc(activityLogs.createdAt))
      .limit(50);

    return {
      totalRequests,
      promptCounts,
      agentAggregates,
      modelAggregates,
      errorLogs,
    };
  }

  async getSystemOverviewStats() {
    const [totalUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    const totalUsers = Number(totalUsersResult?.count || 0);

    const [activeUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isActive, true));
    const activeUsers = Number(activeUsersResult?.count || 0);

    const [bannedUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isActive, false));
    const bannedUsers = Number(bannedUsersResult?.count || 0);

    const [totalFilesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(files);
    const totalFiles = Number(totalFilesResult?.count || 0);

    const [totalExamsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(exams);
    const totalExams = Number(totalExamsResult?.count || 0);

    const [totalRevResult] = await db
      .select({ total: sql<number>`coalesce(sum(cast(${payments.amount} as decimal)), 0)` })
      .from(payments)
      .where(eq(payments.status, 'succeeded'));
    const totalRevenue = parseFloat(Number(totalRevResult?.total || 0).toFixed(2));

    const subscriptionBreakdown = await db
      .select({
        tier: users.subscriptionTier,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .groupBy(users.subscriptionTier);

    const tierBreakdown = {
      free: 0,
      pro: 0,
      institution: 0,
    };

    for (const row of subscriptionBreakdown) {
      const tier = row.tier as keyof typeof tierBreakdown;
      if (tier in tierBreakdown) {
        tierBreakdown[tier] = Number(row.count);
      }
    }

    return {
      totalUsers,
      activeUsers,
      bannedUsers,
      totalFiles,
      totalExams,
      totalRevenue,
      subscriptionBreakdown: tierBreakdown,
    };
  }

  async getRetentionCohortStats() {
    // 1. Fetch all users sign up dates
    const allUsers = await db
      .select({
        id: users.id,
        createdAt: users.createdAt,
      })
      .from(users);

    // 2. Fetch all activity logs timestamps
    const logs = await db
      .select({
        userId: activityLogs.userId,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs);

    // Group logs by userId
    const userLogsMap = new Map<string, Date[]>();
    for (const log of logs) {
      if (!log.userId) continue;
      if (!userLogsMap.has(log.userId)) {
        userLogsMap.set(log.userId, []);
      }
      userLogsMap.get(log.userId)!.push(new Date(log.createdAt));
    }

    // Group users into weekly cohorts
    const cohortsMap = new Map<string, string[]>(); // cohortKey -> userIds[]
    const userSignupMap = new Map<string, Date>(); // userId -> signupDate

    for (const u of allUsers) {
      const signupDate = new Date(u.createdAt);
      userSignupMap.set(u.id, signupDate);

      // Start of week (Sunday)
      const startOfWeek = new Date(signupDate);
      startOfWeek.setDate(signupDate.getDate() - signupDate.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const cohortKey = startOfWeek.toISOString().split('T')[0];

      if (!cohortsMap.has(cohortKey)) {
        cohortsMap.set(cohortKey, []);
      }
      cohortsMap.get(cohortKey)!.push(u.id);
    }

    const cohortRetentionList = [];

    // Calculate retention for each cohort up to 4 weeks
    for (const [cohortKey, userIds] of cohortsMap.entries()) {
      const cohortSize = userIds.length;
      if (cohortSize === 0) continue;

      // Track how many unique users are active in week 0, 1, 2, 3, 4
      const activeInWeek = [0, 0, 0, 0, 0];

      for (const userId of userIds) {
        const signupDate = userSignupMap.get(userId)!;
        const userLogs = userLogsMap.get(userId) || [];

        // Check which weeks this user was active
        const activeWeeksForUser = new Set<number>();
        for (const logDate of userLogs) {
          const diffMs = logDate.getTime() - signupDate.getTime();
          const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
          const weekIndex = Math.floor(diffDays / 7);
          
          if (weekIndex >= 0 && weekIndex <= 4) {
            activeWeeksForUser.add(weekIndex);
          }
        }

        // Increment counts for each week user was active
        // A user is always active in Week 0 because they signed up
        activeWeeksForUser.add(0);

        for (const w of activeWeeksForUser) {
          activeInWeek[w]++;
        }
      }

      // Convert to percentages
      const retentionPercentages = activeInWeek.map((count) =>
        parseFloat(((count / cohortSize) * 100).toFixed(1)),
      );

      cohortRetentionList.push({
        cohort: cohortKey,
        size: cohortSize,
        retention: retentionPercentages,
      });
    }

    // Sort cohorts chronologically
    cohortRetentionList.sort((a, b) => b.cohort.localeCompare(a.cohort));

    return cohortRetentionList;
  }
}
