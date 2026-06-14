import { Injectable, NotFoundException } from '@nestjs/common';
import { db, users, payments, activityLogs, files, exams, eq, and, or, desc, sql } from '@studyai/database';
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
}
