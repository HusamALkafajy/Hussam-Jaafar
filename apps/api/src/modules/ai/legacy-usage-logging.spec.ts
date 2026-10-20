import { HttpException, HttpStatus } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger';
import { checkQuota } from './quota-guard';
import { saveTokenUsage } from './token-tracking';

jest.mock('@studyai/database', () => ({
  db: { select: jest.fn(), insert: jest.fn() },
  aiTokenUsage: { costUSD: {}, userId: {}, createdAt: {} },
}));

const { db } = jest.requireMock<{
  db: { select: jest.Mock; insert: jest.Mock };
}>('@studyai/database');

describe('legacy AI usage logging boundary', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('keeps quota DB failures swallowed but sends only constant safe metadata', async () => {
    const rawError = new Error(`validation-private-${Date.now()}`);
    db.select.mockReturnValue({ from: () => ({ where: jest.fn().mockRejectedValue(rawError) }) });
    const log = jest.spyOn(StructuredLogger.prototype, 'error').mockImplementation();

    await expect(checkQuota('validation-user')).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('AI quota check failed', {
      operation: 'check_quota', status: 'failed',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(rawError.message);
  });

  it('preserves quota rejection and does not log it as a DB failure', async () => {
    db.select.mockReturnValue({ from: () => ({ where: jest.fn().mockResolvedValue([{ totalCost: 1 }]) }) });
    const log = jest.spyOn(StructuredLogger.prototype, 'error').mockImplementation();

    await expect(checkQuota('validation-user')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    await expect(checkQuota('validation-user')).rejects.toBeInstanceOf(HttpException);
    expect(log).not.toHaveBeenCalled();
  });

  it('keeps usage DB failures swallowed without logging the raw insert error', async () => {
    const rawError = new Error(`validation-private-${Date.now()}`);
    db.insert.mockReturnValue({ values: jest.fn().mockRejectedValue(rawError) });
    const log = jest.spyOn(StructuredLogger.prototype, 'error').mockImplementation();

    await expect(saveTokenUsage('validation-user', 'validation-agent', 1, 2, 'validation-model'))
      .resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('AI token usage save failed', {
      operation: 'save_token_usage', status: 'failed',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(rawError.message);
  });

  it('preserves missing-identity guards without DB calls or logs', async () => {
    const log = jest.spyOn(StructuredLogger.prototype, 'error').mockImplementation();

    await checkQuota('');
    await saveTokenUsage('', 'validation-agent', 1, 2, 'validation-model');

    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
