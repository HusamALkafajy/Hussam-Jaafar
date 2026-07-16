import { TokenAccountant } from './token-accountant';
import { IDomainCacheService } from './ports';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

class TestRedisCache implements IDomainCacheService {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> { return this.redis.get(key); }
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) await this.redis.set(key, value, 'EX', ttl);
    else await this.redis.set(key, value);
  }
  async del(key: string): Promise<void> { await this.redis.del(key); }
  async eval<T>(script: string, keys: string[], args: (string | number)[]): Promise<T> {
    return this.redis.eval(script, keys.length, ...keys, ...args) as Promise<T>;
  }
  async hset(key: string, field: string, value: string): Promise<number> { return this.redis.hset(key, field, value); }
  async hget(key: string, field: string): Promise<string | null> { return this.redis.hget(key, field); }
  async hdel(key: string, ...fields: string[]): Promise<number> { return this.redis.hdel(key, ...fields); }
  async hscan(key: string, cursor: string, count: number): Promise<[string, string[]]> {
    const res = await this.redis.hscan(key, cursor, 'COUNT', count);
    return [res[0], res[1]] as [string, string[]];
  }
  async ping(): Promise<string> { return this.redis.ping(); }
}

describe('TokenAccountant Contract Lifecycle', () => {
  let redis: Redis;
  let cache: IDomainCacheService;
  let accountant: TokenAccountant;

  const PENDING_KEY = 'global:pending_reservations';
  const QUOTA = 1000;
  const COST = 100;

  beforeAll(() => {
    // eslint-disable-next-line no-restricted-syntax
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    cache = new TestRedisCache(redis);
    accountant = new TokenAccountant(cache);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
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
    expect(await redis.hexists(PENDING_KEY, reqId)).toBe(1);
  });

  it('2. duplicate reserve(reqId) is idempotent', async () => {
    const userId = randomUUID();
    const reqId = randomUUID();
    await accountant.reserve(userId, reqId, QUOTA, COST);
    const success = await accountant.reserve(userId, reqId, QUOTA, COST);
    
    expect(success).toBe(true); // Short-circuits
    expect(await getConsumed(userId)).toBe(COST); // Didn't double charge
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
