import { TokenAccountant } from './token-accountant';
import { IDomainCacheService } from './ports';
import Redis from 'ioredis';

declare const process: { env: Record<string, string | undefined> };

let testIdSequence = 0;
const randomUUID = (): string => {
  testIdSequence += 1;
  return `test-id-${testIdSequence}`;
};

class TestRedisCache implements IDomainCacheService {
  private readonly strings = new Map<string, string>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly expiresAt = new Map<string, number>();

  private purgeExpired(key: string): void {
    const expiration = this.expiresAt.get(key);
    if (expiration !== undefined && expiration <= Date.now()) {
      this.strings.delete(key);
      this.expiresAt.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.purgeExpired(key);
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.strings.set(key, value);
    if (ttl !== undefined) {
      this.expiresAt.set(key, Date.now() + ttl * 1000);
    } else {
      this.expiresAt.delete(key);
    }
  }

  async del(key: string): Promise<void> {
    this.strings.delete(key);
    this.hashes.delete(key);
    this.expiresAt.delete(key);
  }

  async eval<T>(script: string, keys: string[], args: (string | number)[]): Promise<T> {
    if (script.includes("redis.call('INCRBY'") && script.includes("redis.call('HSET'")) {
      const [consumedKey, pendingKey] = keys;
      const [quota, cost, reqId, payload, retention] = args;
      const pending = this.hashes.get(pendingKey) ?? new Map<string, string>();

      if (pending.has(String(reqId))) {
        return 1 as T;
      }

      this.purgeExpired(consumedKey);
      const consumed = Number(this.strings.get(consumedKey) ?? '0');
      if (consumed + Number(cost) > Number(quota)) {
        return 0 as T;
      }

      this.strings.set(consumedKey, String(consumed + Number(cost)));
      pending.set(String(reqId), String(payload));
      this.hashes.set(pendingKey, pending);
      this.expiresAt.set(consumedKey, Date.now() + Number(retention) * 1000);
      return 1 as T;
    }

    if (script.includes("redis.call('HGET'") && script.includes("redis.call('DECRBY'")) {
      const [pendingKey] = keys;
      const reqId = String(args[0]);
      const pending = this.hashes.get(pendingKey);
      const payloadString = pending?.get(reqId);
      if (!pending || payloadString === undefined) {
        return 0 as T;
      }

      let payload: { userId?: string; cost?: number; consumedKey?: string };
      try {
        payload = JSON.parse(payloadString) as typeof payload;
      } catch {
        pending.delete(reqId);
        return 0 as T;
      }

      if (!payload.userId || payload.cost === undefined) {
        pending.delete(reqId);
        return 0 as T;
      }

      const consumedKey = payload.consumedKey
        ?? `user:${payload.userId}:tokens_consumed`;
      this.purgeExpired(consumedKey);
      const consumedString = this.strings.get(consumedKey);
      pending.delete(reqId);

      if (consumedString === undefined) {
        return 0 as T;
      }

      const consumed = Number(consumedString);
      const cost = Number(payload.cost);
      if (!Number.isFinite(consumed) || !Number.isFinite(cost) || cost <= 0) {
        return 0 as T;
      }

      if (consumed <= 0) {
        if (consumed < 0) this.strings.set(consumedKey, '0');
        return 0 as T;
      }

      this.strings.set(consumedKey, String(consumed - Math.min(consumed, cost)));
      return 1 as T;
    }

    if (script.includes("redis.call('HDEL'")) {
      const deleted = this.hashes.get(keys[0])?.delete(String(args[0])) ? 1 : 0;
      return deleted as T;
    }

    throw new Error('Unexpected Lua contract in deterministic quota test cache');
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    const isNew = hash.has(field) ? 0 : 1;
    hash.set(field, value);
    this.hashes.set(key, hash);
    return isNew;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) return 0;

    let deleted = 0;
    for (const field of fields) {
      if (hash.delete(field)) deleted += 1;
    }
    return deleted;
  }

  async hscan(key: string, _cursor: string, _count: number): Promise<[string, string[]]> {
    const elements = [...(this.hashes.get(key) ?? new Map<string, string>())]
      .flatMap(([field, value]) => [field, value]);
    return ['0', elements];
  }

  async ping(): Promise<string> { return 'PONG'; }

  async hexists(key: string, field: string): Promise<number> {
    return this.hashes.get(key)?.has(field) ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    this.purgeExpired(key);
    if (!this.strings.has(key)) return -2;
    const expiration = this.expiresAt.get(key);
    if (expiration === undefined) return -1;
    return Math.ceil((expiration - Date.now()) / 1000);
  }

  async flushdb(): Promise<void> {
    this.strings.clear();
    this.hashes.clear();
    this.expiresAt.clear();
  }
}

class DisposableRedisCache implements IDomainCacheService {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> { return this.redis.get(key); }
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl !== undefined) await this.redis.set(key, value, 'EX', ttl);
    else await this.redis.set(key, value);
  }
  async del(key: string): Promise<void> { await this.redis.del(key); }
  async eval<T>(script: string, keys: string[], args: (string | number)[]): Promise<T> {
    return this.redis.eval(script, keys.length, ...keys, ...args) as Promise<T>;
  }
  async hset(key: string, field: string, value: string): Promise<number> {
    return this.redis.hset(key, field, value);
  }
  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }
  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.redis.hdel(key, ...fields);
  }
  async hscan(key: string, cursor: string, count: number): Promise<[string, string[]]> {
    const result = await this.redis.hscan(key, cursor, 'COUNT', count);
    return [result[0], result[1]];
  }
  async ping(): Promise<string> { return this.redis.ping(); }
}

describe('TokenAccountant Contract Lifecycle', () => {
  let redis: TestRedisCache;
  let cache: IDomainCacheService;
  let accountant: TokenAccountant;
  let nowSpy: jest.SpyInstance<number, []>;

  const PENDING_KEY = 'global:pending_reservations';
  const QUOTA = 1000;
  const COST = 100;
  const DAY_ONE_TIMESTAMP = Date.parse('2026-08-12T23:59:59.000Z');
  const DAY_TWO_TIMESTAMP = Date.parse('2026-08-13T00:00:02.000Z');
  const dailyKey = (userId: string, day = '2026-08-12') =>
    `user:${userId}:tokens_consumed:${day}`;
  const legacyKey = (userId: string) => `user:${userId}:tokens_consumed`;

  beforeAll(() => {
    redis = new TestRedisCache();
    cache = redis;
    accountant = new TokenAccountant(cache);
  });

  beforeEach(async () => {
    await redis.flushdb();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(DAY_ONE_TIMESTAMP);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  async function getConsumed(userId: string): Promise<number> {
    return accountant.getConsumed(userId);
  }

  it('1. reserve() succeeds', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    const success = await accountant.reserve(userId, reqId, QUOTA, COST);
    expect(success).toBe(true);
    expect(await getConsumed(userId)).toBe(COST);
    expect(await redis.get(dailyKey(userId))).toBe(String(COST));
    expect(await redis.get(legacyKey(userId))).toBeNull();
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(1);

    const payload = JSON.parse((await redis.hget(PENDING_KEY, reqId))!);
    expect(payload.consumedKey).toBe(dailyKey(userId));
  });

  it('2. duplicate reserve(reqId) is idempotent', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    const success = await accountant.reserve(userId, reqId, QUOTA, COST);
    
    expect(success).toBe(true); // Short-circuits
    expect(await getConsumed(userId)).toBe(COST); // Didn't double charge
  });

  it('2a. multiple reservations in one UTC day accumulate in the same bucket', async () => {
    const userId = randomUUID();

    expect(await accountant.reserve(userId, randomUUID(), QUOTA, COST)).toBe(true);
    expect(await accountant.reserve(userId, randomUUID(), QUOTA, COST)).toBe(true);

    expect(await redis.get(dailyKey(userId))).toBe(String(COST * 2));
    expect(await getConsumed(userId)).toBe(COST * 2);
  });

  it('3. commit(reqId) removes from pending but keeps consumed', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    const committed = await accountant.commit(reqId);
    expect(committed).toBe(true);
    
    expect(await getConsumed(userId)).toBe(COST); // Still counted
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(0); // Removed from pending
  });

  it('4. duplicate commit(reqId) returns false', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    await accountant.commit(reqId);
    const committed = await accountant.commit(reqId);
    
    expect(committed).toBe(false);
    expect(await getConsumed(userId)).toBe(COST);
  });

  it('5. release(reqId) removes from pending and refunds consumed', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    const released = await accountant.release(reqId);
    expect(released).toBe(true);
    
    expect(await getConsumed(userId)).toBe(0); // Refunded
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(0); // Removed
  });

  it('6. duplicate release(reqId) returns false', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    await accountant.release(reqId);
    const released = await accountant.release(reqId);
    
    expect(released).toBe(false);
    expect(await getConsumed(userId)).toBe(0); // Only refunded once
  });

  it('7. commit after release is no-op', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    await accountant.release(reqId);
    const committed = await accountant.commit(reqId);
    
    expect(committed).toBe(false);
    expect(await getConsumed(userId)).toBe(0);
  });

  it('8. release after commit is no-op', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    await accountant.commit(reqId);
    const released = await accountant.release(reqId);
    
    expect(released).toBe(false);
    expect(await getConsumed(userId)).toBe(COST);
  });

  it('9. unknown reqId returns false for commit and release', async () => {
    const reqId = randomUUID();
    const committed = await accountant.commit(reqId);
    const released = await accountant.release(reqId);
    
    expect(committed).toBe(false);
    expect(released).toBe(false);
  });

  it('10. concurrent commit vs release only succeeds once', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    const results = await Promise.all([
      accountant.commit(reqId),
      accountant.release(reqId)
    ]);
    
    const successCount = results.filter(r => r === true).length;
    expect(successCount).toBe(1); // One one-shot mutex winner
  });

  it('11. concurrent release vs release only succeeds once', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    const results = await Promise.all([
      accountant.release(reqId),
      accountant.release(reqId),
      accountant.release(reqId)
    ]);
    
    const successCount = results.filter(r => r === true).length;
    expect(successCount).toBe(1);
    expect(await getConsumed(userId)).toBe(0);
  });

  it('12. concurrent commit vs commit only succeeds once', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    const results = await Promise.all([
      accountant.commit(reqId),
      accountant.commit(reqId),
      accountant.commit(reqId)
    ]);
    
    const successCount = results.filter(r => r === true).length;
    expect(successCount).toBe(1);
    expect(await getConsumed(userId)).toBe(COST);
  });

  it('13. Redis retry simulation - recovers from transient cache errors', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    let failures = 0;
    
    // Proxy cache to simulate a network error on the first attempt
    const flakyCache: IDomainCacheService = {
      ...cache,
      eval: async <T>(script: string, keys: string[], args: (string | number)[]) => {
        if (failures === 0) {
          failures++;
          throw new Error('Connection reset by peer');
        }
        return cache.eval<T>(script, keys, args);
      }
    };
    
    const flakyAccountant = new TokenAccountant(flakyCache);
    
    // First attempt fails
    await expect(flakyAccountant.reserve(userId, reqId, QUOTA, COST)).rejects.toThrow('Connection reset by peer');
    
    // Retry succeeds
    const success = await flakyAccountant.reserve(userId, reqId, QUOTA, COST);
    expect(success).toBe(true);
    expect(await getConsumed(userId)).toBe(COST);
  });

  it('14. Lua retry simulation - handles idempotency on network split', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    
    // Proxy cache: simulate the Lua script actually succeeding in Redis, 
    // but the network response dropping before it reaches Node.js.
    const splitBrainCache: IDomainCacheService = {
      ...cache,
      eval: async <T>(script: string, keys: string[], args: (string | number)[]) => {
        // Run it in Redis (state changes!)
        const result = await cache.eval<T>(script, keys, args);
        // But lie to the caller that the network failed
        throw new Error('Timeout waiting for response');
      }
    };
    
    const splitAccountant = new TokenAccountant(splitBrainCache);
    
    // Call 1: Changes state, but throws.
    await expect(splitAccountant.reserve(userId, reqId, QUOTA, COST)).rejects.toThrow('Timeout waiting for response');
    
    // The state was actually mutated in Redis:
    expect(await getConsumed(userId)).toBe(COST);
    
    // Call 2: Retry with normal accountant. Idempotency must kick in and return 1 without double-charging.
    const success = await accountant.reserve(userId, reqId, QUOTA, COST);
    expect(success).toBe(true);
    
    // It should STILL be only 1x COST because of HEXISTS idempotency guard in the Lua script!
    expect(await getConsumed(userId)).toBe(COST);
  });

  it('15. worker/API race simulation (mocked) - worker sweeps before API commits', async () => {
    // API reserves
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    
    // WORKER sweeps (simulated via manual HDEL & DECRBY, which is what the worker does on refund)
    // Wait, the worker does exactly what release() does!
    // So let's simulate the worker releasing it:
    await accountant.release(reqId);
    
    // API tries to commit
    const committed = await accountant.commit(reqId);
    
    // It should return false gracefully (free generation scenario per ADR-006)
    expect(committed).toBe(false);
    expect(await getConsumed(userId)).toBe(0);
  });

  it('16. quota exceeded returns false and leaves state clean', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    const hugeCost = QUOTA + 1;
    
    const success = await accountant.reserve(userId, reqId, QUOTA, hugeCost);
    expect(success).toBe(false);
    
    expect(await getConsumed(userId)).toBe(0);
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(0);
  });

  it('16a. quota denial uses only the current UTC-day bucket', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await redis.set(dailyKey(userId), String(QUOTA - COST + 1));

    expect(await accountant.reserve(userId, reqId, QUOTA, COST)).toBe(false);
    expect(await redis.get(dailyKey(userId))).toBe(String(QUOTA - COST + 1));
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(0);
  });

  it('16b. a new UTC day uses a fresh bucket and ignores historical usage', async () => {
    const userId = randomUUID();
    await redis.set(dailyKey(userId), String(QUOTA));

    nowSpy.mockReturnValue(DAY_TWO_TIMESTAMP);

    expect(await accountant.reserve(userId, randomUUID(), QUOTA, COST)).toBe(true);
    expect(await redis.get(dailyKey(userId, '2026-08-12'))).toBe(String(QUOTA));
    expect(await redis.get(dailyKey(userId, '2026-08-13'))).toBe(String(COST));
    expect(await getConsumed(userId)).toBe(COST);
  });

  it('16c. cross-midnight release refunds the original UTC-day bucket only', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);

    nowSpy.mockReturnValue(DAY_TWO_TIMESTAMP);
    await redis.set(dailyKey(userId, '2026-08-13'), '250');

    expect(await accountant.release(reqId)).toBe(true);
    expect(await redis.get(dailyKey(userId, '2026-08-12'))).toBe('0');
    expect(await redis.get(dailyKey(userId, '2026-08-13'))).toBe('250');
  });

  it('16c.1. expired historical bucket resolves pending without recreating a negative key', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    await redis.del(dailyKey(userId));

    nowSpy.mockReturnValue(DAY_TWO_TIMESTAMP);
    await redis.set(dailyKey(userId, '2026-08-13'), '250');

    expect(await accountant.release(reqId)).toBe(false);
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(0);
    expect(await redis.get(dailyKey(userId, '2026-08-12'))).toBeNull();
    expect(await redis.get(dailyKey(userId, '2026-08-13'))).toBe('250');
    expect(await accountant.release(reqId)).toBe(false);
  });

  it('16c.2. under-value bucket is refunded only to zero', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    await redis.set(dailyKey(userId), '25');

    expect(await accountant.release(reqId)).toBe(true);
    expect(await redis.get(dailyKey(userId))).toBe('0');
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(0);
  });

  it('16d. daily consumed buckets receive a 48-hour retention TTL', async () => {
    const userId = randomUUID();
    await accountant.reserve(userId, randomUUID(), QUOTA, COST);

    const ttl = await redis.ttl(dailyKey(userId));
    expect(ttl).toBeGreaterThanOrEqual(172799);
    expect(ttl).toBeLessThanOrEqual(172800);
    expect(ttl).not.toBe(-1);
  });

  it('16e. getConsumed reads only the current UTC day', async () => {
    const userId = randomUUID();
    await redis.set(dailyKey(userId, '2026-08-12'), '900');
    await redis.set(dailyKey(userId, '2026-08-13'), '125');
    await redis.set(legacyKey(userId), '8000');

    expect(await getConsumed(userId)).toBe(900);
    nowSpy.mockReturnValue(DAY_TWO_TIMESTAMP);
    expect(await getConsumed(userId)).toBe(125);
  });

  it('16f. legacy lifetime usage does not affect new daily admission', async () => {
    const userId = randomUUID();
    await redis.set(legacyKey(userId), String(QUOTA));

    expect(await accountant.reserve(userId, randomUUID(), QUOTA, COST)).toBe(true);
    expect(await redis.get(legacyKey(userId))).toBe(String(QUOTA));
    expect(await redis.get(dailyKey(userId))).toBe(String(COST));
  });

  it('16g. legacy pending payload release refunds the unsuffixed key', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await redis.set(legacyKey(userId), String(COST));
    await redis.set(dailyKey(userId), '75');
    await redis.hset(
      PENDING_KEY,
      reqId,
      JSON.stringify({ userId, cost: COST, timestamp: DAY_ONE_TIMESTAMP }),
    );

    expect(await accountant.release(reqId)).toBe(true);
    expect(await redis.get(legacyKey(userId))).toBe('0');
    expect(await redis.get(dailyKey(userId))).toBe('75');
    expect(await accountant.release(reqId)).toBe(false);
  });

  it('16h. legacy pending payload with a missing counter resolves without recreating it', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await redis.hset(
      PENDING_KEY,
      reqId,
      JSON.stringify({ userId, cost: COST, timestamp: DAY_ONE_TIMESTAMP }),
    );

    expect(await accountant.release(reqId)).toBe(false);
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(0);
    expect(await redis.get(legacyKey(userId))).toBeNull();
    expect(await accountant.release(reqId)).toBe(false);
  });

  it('17. corrupt JSON payload safely ignores rollback', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    
    // Bypass reserve() and put bad data in the pending hash manually
    await redis.hset(PENDING_KEY, reqId, '{"not_a_cost":"hello"}');
    
    const released = await accountant.release(reqId);
    
    // It should return false because it couldn't find cost/userId, BUT it should clean up the hash entry
    expect(released).toBe(false);
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(0);
  });

  describe('getPendingBatch()', () => {
    it('returns empty array when pending hash is empty', async () => {
      const { nextCursor, items } = await accountant.getPendingBatch('0', 10);
      expect(nextCursor).toBe('0');
      expect(items.length).toBe(0);
    });

    it('returns items correctly with payload parsing', async () => {
      const userId = randomUUID();
      const reqId = randomUUID();
      await accountant.reserve(userId, reqId, QUOTA, COST);

      const { nextCursor, items } = await accountant.getPendingBatch('0', 10);
      expect(nextCursor).toBe('0');
      expect(items.length).toBe(1);
      expect(items[0].reqId).toBe(reqId);
      expect(items[0].payload.userId).toBe(userId);
      expect(items[0].payload.cost).toBe(COST);
      expect(typeof items[0].payload.timestamp).toBe('number');
      expect(items[0].payload.consumedKey).toBe(dailyKey(userId));
    });

    it('handles cursor progression', async () => {
      // Redis HSCAN might return everything in one go for small sets, 
      // but we test the interface behavior here.
      // We will mock hscan to simulate pagination.
      const flakyCache: IDomainCacheService = {
        ...cache,
        hscan: async (key: string, cursor: string, count: number) => {
          if (cursor === '0') {
            return ['1', ['req1', JSON.stringify({ userId: 'u1', cost: 10, timestamp: 123 })]] as [string, string[]];
          } else {
            return ['0', ['req2', JSON.stringify({ userId: 'u2', cost: 20, timestamp: 456 })]] as [string, string[]];
          }
        }
      };
      const paginatedAccountant = new TokenAccountant(flakyCache);

      const page1 = await paginatedAccountant.getPendingBatch('0', 1);
      expect(page1.nextCursor).toBe('1');
      expect(page1.items.length).toBe(1);
      expect(page1.items[0].reqId).toBe('req1');

      const page2 = await paginatedAccountant.getPendingBatch('1', 1);
      expect(page2.nextCursor).toBe('0');
      expect(page2.items.length).toBe(1);
      expect(page2.items[0].reqId).toBe('req2');
    });

    it('safely ignores malformed payloads in batch', async () => {
      const reqId1 = randomUUID();
      const reqId2 = randomUUID();
      
      // Manually add bad data and good data
      await redis.hset(PENDING_KEY, reqId1, 'bad-json');
      await redis.hset(PENDING_KEY, reqId2, JSON.stringify({ userId: 'u1', cost: 10, timestamp: 123 }));

      const { nextCursor, items } = await accountant.getPendingBatch('0', 10);
      
      // Should ignore reqId1 entirely
      expect(items.length).toBe(1);
      expect(items[0].reqId).toBe(reqId2);
      expect(items[0].payload.userId).toBe('u1');
    });
  });
});

const disposableRedisUrl = process.env.TOKEN_ACCOUNTANT_TEST_REDIS_URL;
const describeDisposableRedis = disposableRedisUrl ? describe : describe.skip;

describeDisposableRedis('TokenAccountant disposable Redis reality check', () => {
  let redis: Redis;
  let accountant: TokenAccountant;
  let nowSpy: jest.SpyInstance<number, []>;

  const dayOneTimestamp = Date.parse('2026-08-12T23:59:59.000Z');
  const dayTwoTimestamp = Date.parse('2026-08-13T00:00:02.000Z');
  const userId = 'disposable-reality-check-user';
  const dayOneKey = `user:${userId}:tokens_consumed:2026-08-12`;
  const dayTwoKey = `user:${userId}:tokens_consumed:2026-08-13`;

  beforeAll(async () => {
    redis = new Redis(disposableRedisUrl!, { maxRetriesPerRequest: 1 });
    await redis.flushdb();
    accountant = new TokenAccountant(new DisposableRedisCache(redis));
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(dayOneTimestamp);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('executes daily accumulation, TTL, rollover, and exact-bucket release in Redis', async () => {
    const firstRequest = 'disposable-day-one-first';
    expect(await accountant.reserve(userId, firstRequest, 1000, 100)).toBe(true);
    expect(await accountant.reserve(userId, 'disposable-day-one-second', 1000, 100)).toBe(true);
    expect(await redis.get(dayOneKey)).toBe('200');
    expect(await redis.ttl(dayOneKey)).toBeGreaterThan(0);

    nowSpy.mockReturnValue(dayTwoTimestamp);
    expect(await accountant.reserve(userId, 'disposable-day-two', 1000, 100)).toBe(true);
    expect(await redis.get(dayTwoKey)).toBe('100');

    expect(await accountant.release(firstRequest)).toBe(true);
    expect(await redis.get(dayOneKey)).toBe('100');
    expect(await redis.get(dayTwoKey)).toBe('100');
  });

  it('does not recreate missing or negative counters during release', async () => {
    const expiredRequest = 'disposable-expired-bucket';
    expect(await accountant.reserve(userId, expiredRequest, 1000, 100)).toBe(true);
    await redis.del(dayOneKey);

    nowSpy.mockReturnValue(dayTwoTimestamp);
    await redis.set(dayTwoKey, '250');

    expect(await accountant.release(expiredRequest)).toBe(false);
    expect(await redis.get(dayOneKey)).toBeNull();
    expect(await redis.get(dayTwoKey)).toBe('250');

    nowSpy.mockReturnValue(dayOneTimestamp);
    const underValueRequest = 'disposable-under-value-bucket';
    expect(await accountant.reserve(userId, underValueRequest, 1000, 100)).toBe(true);
    await redis.set(dayOneKey, '25');
    expect(await accountant.release(underValueRequest)).toBe(true);
    expect(await redis.get(dayOneKey)).toBe('0');

    const legacyRequest = 'disposable-missing-legacy-bucket';
    const legacyKey = `user:${userId}:tokens_consumed`;
    await redis.hset(
      'global:pending_reservations',
      legacyRequest,
      JSON.stringify({ userId, cost: 100, timestamp: dayOneTimestamp }),
    );
    expect(await accountant.release(legacyRequest)).toBe(false);
    expect(await redis.get(legacyKey)).toBeNull();
  });
});
