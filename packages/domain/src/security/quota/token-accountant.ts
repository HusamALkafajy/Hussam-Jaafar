import { IDomainCacheService } from './ports';

/** Redis key that stores all in-flight pending reservations as a Hash. */
const PENDING_KEY = 'global:pending_reservations';

/** Retains completed UTC-day buckets long enough for cleanup and late refunds. */
const DAILY_KEY_RETENTION_SECONDS = 48 * 60 * 60;

const getUtcDayId = (timestamp: number): string =>
  new Date(timestamp).toISOString().slice(0, 10);

const getDailyConsumedKey = (userId: string, timestamp: number): string =>
  `user:${userId}:tokens_consumed:${getUtcDayId(timestamp)}`;

/**
 * Payload stored per reqId in PENDING_KEY.
 * Serialised as JSON so it survives as a single Hash field value.
 */
export interface PendingPayload {
  userId: string;
  cost: number;
  /** Unix timestamp (ms) when the reservation was created. */
  timestamp: number;
  /** Exact UTC-day counter charged by this reservation. */
  consumedKey?: string;
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
   * KEYS[1] = user:{userId}:tokens_consumed:{YYYY-MM-DD}
   * KEYS[2] = global:pending_reservations
   * ARGV[1] = quota (number)
   * ARGV[2] = cost  (number)
   * ARGV[3] = reqId (string)
   * ARGV[4] = JSON-serialised PendingPayload (string)
   * ARGV[5] = daily key retention in seconds
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
    local retention   = tonumber(ARGV[5])

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
    redis.call('EXPIRE', consumedKey, retention)
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
   *  3. Refund the original counter without creating a missing or negative key.
   *
   * KEYS[1] = global:pending_reservations
   * ARGV[1] = reqId
   *
   * Returns: 1 if a counter refund was applied, 0 if no refund was possible.
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

    local cost   = tonumber(payload.cost)
    local userId = payload.userId

    -- New reservations carry the exact UTC-day counter they charged. Old
    -- in-flight reservations fall back to the legacy lifetime key so rolling
    -- deployments can still refund them safely.
    local consumedKey = payload.consumedKey
    if not consumedKey or type(consumedKey) ~= 'string' then
      consumedKey = 'user:' .. userId .. ':tokens_consumed'
    end

    local consumedStr = redis.call('GET', consumedKey)
    redis.call('HDEL', pendingKey, reqId)

    -- The original bucket may have expired before reconciliation. Resolving
    -- the pending entry is still correct, but DECRBY on a missing key would
    -- recreate it as a persistent negative counter.
    if not consumedStr then
      return 0
    end

    local consumed = tonumber(consumedStr)
    if not cost or cost <= 0 or not consumed then
      return 0
    end

    -- A valid reservation guarantees consumed >= cost. If external
    -- corruption leaves less usage than the refund, remove only the available
    -- amount so the counter reaches zero and keeps its existing TTL.
    if consumed <= 0 then
      if consumed < 0 then
        redis.call('INCRBY', consumedKey, -consumed)
      end
      return 0
    end

    local refund = math.min(consumed, cost)
    redis.call('DECRBY', consumedKey, refund)
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
    const timestamp = Date.now();
    const consumedKey = getDailyConsumedKey(userId, timestamp);
    const payload: PendingPayload = { userId, cost, timestamp, consumedKey };

    const result = await this.cache.eval<number>(
      TokenAccountant.RESERVE_LUA,
      [consumedKey, PENDING_KEY],
      [quota, cost, reqId, JSON.stringify(payload), DAILY_KEY_RETENTION_SECONDS],
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
   * @returns `true` if tokens were refunded, `false` if already resolved or
   *          the original consumed counter no longer exists.
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
   * Returns the current UTC calendar day's consumed token count for a user.
   * Historical daily buckets and the legacy lifetime counter are excluded.
   * Used for health checks and debugging only — not in the hot path.
   */
  async getConsumed(userId: string): Promise<number> {
    const consumedKey = getDailyConsumedKey(userId, Date.now());
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
