import { db, aiTokenUsage } from '@studyai/database';
import { eq, sql, and, gte } from 'drizzle-orm';
import { HttpException, HttpStatus } from '@nestjs/common';

const MAX_FREE_TIER_COST_USD = 0.50; // hardcoded limit

export const checkQuota = async (userId: string) => {
  if (!userId) return; // Skip if no user context
  
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  try {
    const result = await db
      .select({ totalCost: sql<number>`SUM(CAST(${aiTokenUsage.costUSD} AS FLOAT))` })
      .from(aiTokenUsage)
      .where(
        and(
          eq(aiTokenUsage.userId, userId),
          gte(aiTokenUsage.createdAt, startOfMonth)
        )
      );
      
    const totalCost = result[0]?.totalCost || 0;
    
    if (totalCost >= MAX_FREE_TIER_COST_USD) {
      throw new HttpException('AI Quota Exceeded for this month', HttpStatus.TOO_MANY_REQUESTS);
    }
  } catch (err) {
    if (err instanceof HttpException) throw err;
    console.error('Failed to check quota:', err);
  }
};