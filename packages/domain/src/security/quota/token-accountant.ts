import { IDomainCacheService } from './ports';

/** Redis key that stores all in-flight pending reservations as a Hash. */
const PENDING_KEY = 'global:pending_reservations';

/**
 * Payload stored per reqId in PENDING_KEY.
 * Serialised as JSON so it survives as a single Hash field value.
 */
export interface PendingPayload {
  userId: string;
  cost: number;
  /** Unix timestamp (ms) when the reservation was created. */
  timestamp: number;
}

export class TokenAccountant {
  /**
   * ADR-007 — RESERVE_LUA
   *
   * Atomically:
   *  1. Short-circuit if this reqId is already pending (idempotent retry).
   *  2. Reject if consumed + cost > quota.
   *  3. INCRBY the user's total counter.
   *  4. HSET the pending payload (reqId → JSON).
   *
   * KEYS[1] = user:{userId}:tokens_consumed
   * KEYS[2] = global:pending_reservations
   * ARGV[1] = quota (number)
   * ARGV[2] = cost  (number)
   * ARGV[3] = reqId (string)
   * ARGV[4] = JSON-serialised PendingPayload (string)
   *
   * Returns: 1 (admitted) | 0 (quota exceeded)
   */
  private static readonly RESERVE_LUA = `
    local consumedKey = KEYS[1]
    local pendingKey  = KEYS[2]
    local quota       = tonumber(ARGV[1])
    local cost        = tonumber(ARGV[2])
    local reqId       = ARGV[3]
    local payload     = ARGV[4]

    -- Idempotency: already reserved — admit without double-charging
    if redis.call('HEXISTS', pendingKey, reqId) == 1 then
      return 1
    end

    local consumed = tonumber(redis.call('GET', consumedKey) or '0')
    if consumed + cost > quota then
      return 0
    end

    redis.call('INCRBY', consumedKey, cost)
    redis.call('HSET',   pendingKey,  reqId, payload)
    return 1
  `;

  /**
   * ADR-007 — COMMIT_LUA
   *
   * Atomically:
   *  1. HDEL the reqId from pending_reservations.
   *
   * KEYS[1] = global:pending_reservations
   * ARGV[1] = reqId
   *
   * Returns: 1 if deleted (committed), 0 if not found (already resolved)
   */
  private static readonly COMMIT_LUA = `
    return redis.call('HDEL', KEYS[1], ARGV[1])
  `;

  /**
   * ADR-007 — RELEASE_LUA
   *
   * Atomically:
   *  1. HGET the payload. If not found, return 0 (already resolved).
   *  2. HDEL the reqId.
   *  3. DECRBY the user's total counter by cost.
   *
   * KEYS[1] = global:pending_reservations
   * ARGV[1] = reqId
   *
   * Returns: 1 if deleted (refunded), 0 if not found (already resolved)
   */
  private static readonly RELEASE_LUA = `
    local pendingKey = KEYS[1]
    local reqId      = ARGV[1]

    local payloadStr = redis.call('HGET', pendingKey, reqId)
    if not payloadStr then
      return 0
    end

    -- We must parse the JSON to get the cost and userId.
    -- cjson.decode safely parses JSON in Redis Lua.
    local success, payload = pcall(cjson.decode, payloadStr)
    if not success or not payload.cost or not payload.userId then
      -- Corrupt payload. Delete it anyway to prevent infinite loops, but don't decrement.
      redis.call('HDEL', pendingKey, reqId)
      return 0
    end

    local cost        = tonumber(payload.cost)
    local userId      = payload.userId
    local consumedKey = 'user:' .. userId .. ':tokens_consumed'

    redis.call('HDEL', pendingKey, reqId)
    redis.call('DECRBY', consumedKey, cost)
    
    return 1
  `;

  constructor(private readonly cache: IDomainCacheService) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Attempts to reserve `cost` tokens for `userId`.
   *
   * @param userId  - The user whose quota is checked.
   * @param reqId   - Caller-generated UUIDv4 that uniquely identifies this HTTP request.
   * @param quota   - The user's daily token limit.
   * @param cost    - Tokens required for this operation.
   * @returns `true` if admitted, `false` if quota exceeded.
   */
  async reserve(
    userId: string,
    reqId: string,
    quota: number,
    cost: number,
  ): Promise<boolean> {
    const consumedKey = `user:${userId}:tokens_consumed`;
    const payload: PendingPayload = { userId, cost, timestamp: Date.now() };

    const result = await this.cache.eval<number>(
      TokenAccountant.RESERVE_LUA,
      [consumedKey, PENDING_KEY],
      [quota, cost, reqId, JSON.stringify(payload)],
    );
    return result === 1;
  }

  /**
   * Commits the reservation identified by `reqId`.
   *
   * Removes the pending entry, leaving the consumed counter incremented.
   * Safe to call multiple times — subsequent calls are no-ops.
   *
   * @returns `true` if this call committed it, `false` if already resolved.
   */
  async commit(reqId: string): Promise<boolean> {
    const result = await this.cache.eval<number>(
      TokenAccountant.COMMIT_LUA,
      [PENDING_KEY],
      [reqId],
    );
    return result === 1;
  }

  /**
   * Releases (refunds) the reservation identified by `reqId`.
   *
   * Removes the pending entry AND decrements the consumed counter.
   * Safe to call multiple times — subsequent calls are no-ops.
   *
   * @returns `true` if tokens were refunded, `false` if already resolved.
   */
  async release(reqId: string): Promise<boolean> {
    const result = await this.cache.eval<number>(
      TokenAccountant.RELEASE_LUA,
      [PENDING_KEY],
      [reqId],
    );
    return result === 1;
  }

  /**
   * Returns the current consumed token count for a user.
   * Used for health checks and debugging only — not in the hot path.
   */
  async getConsumed(userId: string): Promise<number> {
    const consumedKey = `user:${userId}:tokens_consumed`;
    const val = await this.cache.get(consumedKey);
    return val ? parseInt(val, 10) : 0;
  }

  /**
   * Iterates through pending reservations for worker reconciliation.
   * Encapsulates the Redis HSCAN command and internal key structure.
   */
  async getPendingBatch(cursor: string, count: number): Promise<{ nextCursor: string, items: { reqId: string, payload: PendingPayload }[] }> {
    const [nextCursor, elements] = await this.cache.hscan(PENDING_KEY, cursor, count);
    
    const items: { reqId: string, payload: PendingPayload }[] = [];
    
    // elements array alternates: [key1, value1, key2, value2, ...]
    for (let i = 0; i < elements.length; i += 2) {
      const reqId = elements[i];
      const payloadStr = elements[i + 1];
      
      try {
        const payload: PendingPayload = JSON.parse(payloadStr);
        items.push({ reqId, payload });
      } catch (e) {
        // Ignore malformed payloads - release() will handle cleanup if called on them.
      }
    }
    
    return { nextCursor, items };
  }
}
