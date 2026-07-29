import { describe, expect, it } from 'vitest';

type LockClient = {
  unsafe: (
    query: string,
    parameters: string[],
  ) => Promise<Array<{ unlocked?: boolean }>>;
  end: (options: { timeout: number }) => Promise<void>;
};

type WithMigrationLock = (options: {
  databaseUrl: string;
  postgresFactory: (
    databaseUrl: string,
    options: { max: number; max_lifetime: null },
  ) => LockClient;
  runMigration: () => Promise<number>;
}) => Promise<number>;

const {
  acquireMigrationLockSql,
  migrationLockNamespace,
  releaseMigrationLockSql,
  withMigrationLock,
} = require('../../scripts/run-drizzle-kit.cjs') as {
  acquireMigrationLockSql: string;
  migrationLockNamespace: string;
  releaseMigrationLockSql: string;
  withMigrationLock: WithMigrationLock;
};

const deferred = () => {
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
};

const testEndpoint = (databaseName: string) =>
  `postgresql://local/${databaseName}`;

class AdvisoryLockCoordinator {
  private readonly owners = new Map<string, symbol>();
  private readonly waiters = new Map<
    string,
    Array<{ owner: symbol; resolve: () => void }>
  >();

  readonly closedClients: string[] = [];

  postgresFactory = (
    databaseUrl: string,
    options: { max: number; max_lifetime: null },
  ): LockClient => {
    expect(options).toEqual({ max: 1, max_lifetime: null });

    const databaseName = new URL(databaseUrl).pathname.slice(1);
    const owner = Symbol(databaseName);
    let lockHeld = false;

    return {
      unsafe: async (query, parameters) => {
        expect(parameters).toEqual([migrationLockNamespace]);

        if (query.includes('pg_advisory_lock(')) {
          await this.acquire(databaseName, owner);
          lockHeld = true;
          return [{}];
        }

        if (query.includes('pg_advisory_unlock(')) {
          const unlocked = lockHeld && this.release(databaseName, owner);
          lockHeld = false;
          return [{ unlocked }];
        }

        throw new Error(`Unexpected advisory-lock query: ${query}`);
      },
      end: async ({ timeout }) => {
        expect(timeout).toBe(5);
        if (lockHeld) {
          this.release(databaseName, owner);
          lockHeld = false;
        }
        this.closedClients.push(databaseName);
      },
    };
  };

  private acquire(databaseName: string, owner: symbol) {
    if (!this.owners.has(databaseName)) {
      this.owners.set(databaseName, owner);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const queue = this.waiters.get(databaseName) ?? [];
      queue.push({ owner, resolve });
      this.waiters.set(databaseName, queue);
    });
  }

  private release(databaseName: string, owner: symbol) {
    if (this.owners.get(databaseName) !== owner) {
      return false;
    }

    const queue = this.waiters.get(databaseName) ?? [];
    const next = queue.shift();

    if (next) {
      this.owners.set(databaseName, next.owner);
      next.resolve();
    } else {
      this.owners.delete(databaseName);
    }

    return true;
  }
}

describe('Drizzle migration orchestration lock', () => {
  it('serializes simultaneous compatible runners through delayed history insertion and commit', async () => {
    const coordinator = new AdvisoryLockCoordinator();
    const simultaneousStart = deferred();
    const firstHistoryDecision = deferred();
    const permitHistoryInsert = deferred();
    const historyInsertPrepared = deferred();
    const permitCommit = deferred();
    const state = {
      history: [] as string[],
      schemaApplications: 0,
    };
    let pendingMigration = true;
    let activeRunners = 0;
    let maximumActiveRunners = 0;
    let historyDecisions = 0;

    const runCompatibleMigration = async () => {
      activeRunners += 1;
      maximumActiveRunners = Math.max(maximumActiveRunners, activeRunners);
      historyDecisions += 1;

      try {
        if (state.history.includes('0022')) {
          return 0;
        }

        if (pendingMigration) {
          pendingMigration = false;
          firstHistoryDecision.resolve();
          await permitHistoryInsert.promise;

          const stagedHistory = [...state.history, '0022'];
          historyInsertPrepared.resolve();
          await permitCommit.promise;

          state.schemaApplications += 1;
          state.history = stagedHistory;
        }

        return 0;
      } finally {
        activeRunners -= 1;
      }
    };

    const startRunner = () =>
      simultaneousStart.promise.then(() =>
        withMigrationLock({
          databaseUrl: testEndpoint('migration_test'),
          postgresFactory: coordinator.postgresFactory,
          runMigration: runCompatibleMigration,
        }),
      );

    const firstRunner = startRunner();
    const secondRunner = startRunner();
    simultaneousStart.resolve();

    await firstHistoryDecision.promise;
    expect(activeRunners).toBe(1);
    expect(state.history).toEqual([]);

    permitHistoryInsert.resolve();
    await historyInsertPrepared.promise;
    expect(state.history).toEqual([]);

    permitCommit.resolve();
    await expect(Promise.all([firstRunner, secondRunner])).resolves.toEqual([
      0, 0,
    ]);

    expect(maximumActiveRunners).toBe(1);
    expect(historyDecisions).toBe(2);
    expect(state.schemaApplications).toBe(1);
    expect(state.history).toEqual(['0022']);
    expect(coordinator.closedClients).toEqual([
      'migration_test',
      'migration_test',
    ]);
  });

  it('releases the lock after rollback without schema mutation or orphan history', async () => {
    const coordinator = new AdvisoryLockCoordinator();
    const simultaneousStart = deferred();
    const failingRunnerEntered = deferred();
    const permitRollback = deferred();
    const state = {
      history: [] as string[],
      schemaApplications: 0,
    };
    let attempts = 0;
    let activeRunners = 0;

    const runMigration = async () => {
      activeRunners += 1;
      attempts += 1;

      try {
        if (state.history.includes('0022')) {
          return 0;
        }

        if (attempts === 1) {
          failingRunnerEntered.resolve();
          await permitRollback.promise;
          return 1;
        }

        state.schemaApplications += 1;
        state.history.push('0022');
        return 0;
      } finally {
        activeRunners -= 1;
      }
    };

    const startRunner = () =>
      simultaneousStart.promise.then(() =>
        withMigrationLock({
          databaseUrl: testEndpoint('rollback_test'),
          postgresFactory: coordinator.postgresFactory,
          runMigration,
        }),
      );

    const firstRunner = startRunner();
    const secondRunner = startRunner();
    simultaneousStart.resolve();

    await failingRunnerEntered.promise;
    expect(activeRunners).toBe(1);
    expect(state).toEqual({ history: [], schemaApplications: 0 });

    permitRollback.resolve();
    const results = await Promise.all([firstRunner, secondRunner]);

    expect(results.sort()).toEqual([0, 1]);
    expect(state.schemaApplications).toBe(1);
    expect(state.history).toEqual(['0022']);
    expect(coordinator.closedClients).toEqual([
      'rollback_test',
      'rollback_test',
    ]);
  });

  it('uses a database-scoped key and does not serialize different databases', async () => {
    const coordinator = new AdvisoryLockCoordinator();
    const firstDatabaseEntered = deferred();
    const releaseFirstDatabase = deferred();
    const secondDatabaseEntered = deferred();

    const first = withMigrationLock({
      databaseUrl: testEndpoint('database_a'),
      postgresFactory: coordinator.postgresFactory,
      runMigration: async () => {
        firstDatabaseEntered.resolve();
        await releaseFirstDatabase.promise;
        return 0;
      },
    });

    await firstDatabaseEntered.promise;

    const second = withMigrationLock({
      databaseUrl: testEndpoint('database_b'),
      postgresFactory: coordinator.postgresFactory,
      runMigration: async () => {
        secondDatabaseEntered.resolve();
        return 0;
      },
    });

    await secondDatabaseEntered.promise;
    await expect(second).resolves.toBe(0);

    releaseFirstDatabase.resolve();
    await expect(first).resolves.toBe(0);

    expect(acquireMigrationLockSql).toContain('current_database()::text');
    expect(releaseMigrationLockSql).toContain('current_database()::text');
  });
});
