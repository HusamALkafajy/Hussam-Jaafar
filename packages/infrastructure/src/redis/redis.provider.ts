import Redis from 'ioredis';
import { IDomainCacheService } from '@studyai/domain';

export class RedisCacheProvider implements IDomainCacheService {
  constructor(private readonly redis: Redis) {}

  // ── Scalar operations ──────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // ── Lua atomicity ──────────────────────────────────────────────────────────

  async eval<T>(script: string, keys: string[], args: (string | number)[]): Promise<T> {
    return this.redis.eval(script, keys.length, ...keys, ...args) as Promise<T>;
  }

  // ── Hash operations (ADR-007) ──────────────────────────────────────────────

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
    // ioredis returns [nextCursor, [field, value, field, value, ...]]
    return this.redis.hscan(key, cursor, 'COUNT', count) as Promise<[string, string[]]>;
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async ping(): Promise<string> {
    return this.redis.ping();
  }

  async close(): Promise<void> {
    this.redis.disconnect();
  }
}

