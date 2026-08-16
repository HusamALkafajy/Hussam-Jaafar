import { db, aiTokenUsage } from '@studyai/database';

export const saveTokenUsage = async (userId: string, agentType: string, promptTokens: number, completionTokens: number, model: string) => {
  if (!userId || !agentType) return;
  let costUSD = 0;
  if (model.includes('gemini-2.5-flash')) {
    costUSD = (promptTokens / 1000000) * 0.075 + (completionTokens / 1000000) * 0.3;
  }
  
  try {
    await db.insert(aiTokenUsage).values({
      userId,
      agentType,
      model,
      promptTokens,
      completionTokens,
      costUSD: costUSD.toString(),
    });
  } catch (err) {
    console.error('Failed to save token usage:', err);
  }
};