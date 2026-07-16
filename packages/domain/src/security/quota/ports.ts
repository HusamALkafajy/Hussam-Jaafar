export interface IDomainCacheService {
  // ── Scalar operations ─────────────────────────────────────────────────────
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;

  // ── Lua atomicity ─────────────────────────────────────────────────────────
  eval<T>(script: string, keys: string[], args: (string | number)[]): Promise<T>;

  // ── Hash operations (ADR-007 — pending reservation tracking) ─────────────
  /** Set a single field in a Redis Hash. Returns 1 if new field, 0 if updated. */
  hset(key: string, field: string, value: string): Promise<number>;
  /** Get a single field from a Redis Hash. Returns null if key or field absent. */
  hget(key: string, field: string): Promise<string | null>;
  /** Delete one or more fields from a Redis Hash. Returns count of deleted fields. */
  hdel(key: string, ...fields: string[]): Promise<number>;
  /**
   * Incrementally iterate Hash fields.
   * Returns [nextCursor, flatArray] where flatArray alternates field, value.
   * Pass cursor='0' to start; iteration is complete when nextCursor === '0'.
   */
  hscan(key: string, cursor: string, count: number): Promise<[string, string[]]>;

  ping(): Promise<string>;
}
