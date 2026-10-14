jest.mock('@studyai/database', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
  },
  aiTokenUsage: {
    costUSD: 'costUSD',
    userId: 'userId',
    createdAt: 'createdAt',
  },
}));

jest.mock('drizzle-orm', () => ({
  and: jest.fn(() => 'and'),
  eq: jest.fn(() => 'eq'),
  gte: jest.fn(() => 'gte'),
  sql: jest.fn(() => 'sum'),
}));

import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { db } from '@studyai/database';
import { checkQuota } from './quota-guard';
import { saveTokenUsage } from './token-tracking';

describe('AI quota telemetry logging', () => {
  const select = db.select as unknown as jest.Mock;
  const insert = db.insert as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits bounded structured quota metadata without serializing the failure', async () => {
    const canary = `private-prompt-${Date.now()}-${Math.random()}`;
    const error = new Error(canary);
    const where = jest.fn().mockRejectedValue(error);
    select.mockReturnValue({
      from: jest.fn().mockReturnValue({ where }),
    });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(checkQuota('user-1')).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith({
      event: 'ai.quota.check.failed',
      reasonCode: 'usage_lookup_failed',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(canary);
    expect(JSON.stringify(log.mock.calls)).not.toContain('user-1');
  });

  it('preserves quota rejection without logging it as an operational failure', async () => {
    const where = jest.fn().mockResolvedValue([{ totalCost: 0.5 }]);
    select.mockReturnValue({
      from: jest.fn().mockReturnValue({ where }),
    });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(checkQuota('user-1')).rejects.toEqual(
      new HttpException('AI Quota Exceeded for this month', HttpStatus.TOO_MANY_REQUESTS),
    );
    expect(log).not.toHaveBeenCalled();
  });

  it('emits bounded structured token metadata without serializing the failure', async () => {
    const canary = `provider-response-${Date.now()}-${Math.random()}`;
    const values = jest.fn().mockRejectedValue(new Error(canary));
    insert.mockReturnValue({ values });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      saveTokenUsage('user-1', 'stream_call', 10, 20, 'gemini-2.5-flash'),
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith({
      event: 'ai.token_usage.persist.failed',
      reasonCode: 'usage_persistence_failed',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(canary);
    expect(JSON.stringify(log.mock.calls)).not.toContain('user-1');
  });

  it('preserves token calculation and persistence values', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    insert.mockReturnValue({ values });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await saveTokenUsage('user-1', 'stream_call', 1_000_000, 1_000_000, 'gemini-2.5-flash');

    expect(values).toHaveBeenCalledWith({
      userId: 'user-1',
      agentType: 'stream_call',
      model: 'gemini-2.5-flash',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      costUSD: '0.375',
    });
    expect(log).not.toHaveBeenCalled();
  });
});
